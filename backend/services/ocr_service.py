import re
import os
import io
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import pymupdf  # Modern PyMuPDF import

# Ensure tesseract executable path on macOS if needed
if os.path.exists('/opt/homebrew/bin/tesseract'):
    pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'

class MedicalOCREngine:
    """Intelligent OCR and medical parameter extractor for clinical lab reports."""

    @staticmethod
    def extract_text(file_bytes: bytes, filename: str = "") -> str:
        """Extract raw text from PDF or Image files."""
        is_pdf = filename.lower().endswith('.pdf') or file_bytes.startswith(b'%PDF')
        
        if is_pdf:
            return MedicalOCREngine._extract_from_pdf(file_bytes)
        else:
            return MedicalOCREngine._extract_from_image(file_bytes)

    @staticmethod
    def _extract_from_pdf(pdf_bytes: bytes) -> str:
        text_content = []
        try:
            doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                page_text = page.get_text("text").strip()
                
                # If page has embedded text
                if len(page_text) > 30:
                    text_content.append(page_text)
                else:
                    # Scanned PDF: Render page to high-res image and OCR
                    pix = page.get_pixmap(dpi=200)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    ocr_text = pytesseract.image_to_string(img)
                    text_content.append(ocr_text)
            doc.close()
        except Exception as e:
            text_content.append(f"PDF Extraction Error: {str(e)}")
            
        return "\n".join(text_content)

    @staticmethod
    def _extract_from_image(img_bytes: bytes) -> str:
        try:
            image = Image.open(io.BytesIO(img_bytes))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Preprocess image for OCR accuracy (grayscale + contrast enhancement)
            gray = image.convert('L')
            enhancer = ImageEnhance.Contrast(gray)
            enhanced = enhancer.enhance(1.8)
            
            # Run Tesseract OCR
            text = pytesseract.image_to_string(enhanced)
            if not text.strip():
                # Fallback to raw image OCR
                text = pytesseract.image_to_string(image)
            return text
        except Exception as e:
            return f"Image OCR Error: {str(e)}"

    @staticmethod
    def parse_report_parameters(text: str, disease_type: str = "all") -> dict:
        """Parse clinical values from extracted text using intelligent heuristics and regex."""
        extracted = {}
        cleaned_text = text.replace('\r', '\n')
        lines = [line.strip() for line in cleaned_text.split('\n') if line.strip()]

        # Helper to search line by line or entire text
        def find_param_number(patterns, default_unit="", min_val=0, max_val=1000):
            for pat in patterns:
                m = re.search(pat, cleaned_text, re.IGNORECASE)
                if m:
                    for g in m.groups():
                        if g is not None:
                            try:
                                val = float(g)
                                if min_val <= val <= max_val:
                                    return val, m.group(0)
                            except ValueError:
                                continue
            return None, None

        # 1. Glucose / Fasting Blood Sugar
        g_val, g_match = find_param_number([
            r'(?:fasting\s*blood\s*sugar|fbs|fasting\s*sugar|sugar\s*fasting|blood\s*sugar|glucose|rbs)[^0-9\n]{0,30}?([0-9]{2,3}(?:\.[0-9]+)?)',
            r'(?:glucose|blood\s*glucose)[^0-9\n]{0,20}?([0-9]{2,3}(?:\.[0-9]+)?)'
        ], min_val=40, max_val=600)
        if g_val is not None:
            extracted['glucose'] = {
                'value': g_val,
                'confidence': 0.96,
                'unit': 'mg/dL',
                'normal_range': '70 - 99 mg/dL',
                'matched_text': g_match.strip(),
                'status': 'High (Diabetic)' if g_val >= 126 else ('Prediabetic' if g_val >= 100 else 'Normal')
            }

        # 2. Blood Pressure (Systolic / Diastolic)
        bp_match = re.search(
            r'(?:blood\s*pressure|b\.?p\.?|resting\s*bp|trestbps)[^0-9\n]{0,25}?([0-9]{2,3})\s*(?:/|\\|\s|-)\s*([0-9]{2,3})',
            cleaned_text,
            re.IGNORECASE
        )
        if bp_match:
            sys_val = float(bp_match.group(1))
            dia_val = float(bp_match.group(2))
            extracted['blood_pressure'] = {
                'value': dia_val if sys_val > 100 and dia_val > 40 else sys_val,
                'systolic': sys_val,
                'diastolic': dia_val,
                'confidence': 0.95,
                'unit': 'mm Hg',
                'normal_range': '< 120/80 mm Hg',
                'matched_text': bp_match.group(0).strip(),
                'status': 'Hypertension' if sys_val >= 130 or dia_val >= 80 else 'Normal'
            }
            extracted['trestbps'] = {
                'value': sys_val,
                'confidence': 0.95,
                'status': 'derived',
                'rule_id': 'TRESTBPS_FROM_BLOOD_PRESSURE',
                'source_features': ['blood_pressure'],
                'unit': 'mm Hg',
                'normal_range': '90 - 120 mm Hg',
                'matched_text': bp_match.group(0).strip()
            }
        else:
            sys_val, sys_match = find_param_number([
                r'(?:systolic|resting\s*blood\s*pressure|trestbps)[^0-9\n]{0,20}?([0-9]{2,3})'
            ], min_val=50, max_val=250)
            if sys_val is not None:
                extracted['blood_pressure'] = {'value': sys_val, 'confidence': 0.85, 'unit': 'mm Hg', 'matched_text': sys_match}
                extracted['trestbps'] = {
                    'value': sys_val, 'confidence': 0.85, 'status': 'derived',
                    'rule_id': 'TRESTBPS_FROM_SYSTOLIC_PRESSURE',
                    'source_features': ['blood_pressure'], 'unit': 'mm Hg', 'matched_text': sys_match,
                }

        # 3. Insulin
        ins_val, ins_match = find_param_number([
            r'(?:serum\s*insulin|fasting\s*insulin|insulin)[^0-9\n]{0,20}?([0-9]{1,3}(?:\.[0-9]+)?)'
        ], min_val=1, max_val=900)
        if ins_val is not None:
            extracted['insulin'] = {
                'value': ins_val,
                'confidence': 0.94,
                'unit': 'μU/mL',
                'normal_range': '2.6 - 24.9 μU/mL',
                'matched_text': ins_match.strip(),
                'status': 'Elevated' if ins_val > 25 else 'Normal'
            }

        # 4. Weight / height evidence (used only for a transparent BMI derivation)
        weight_m = re.search(r'(?:weight|wt)[^0-9\n]{0,10}?([0-9]{2,3}(?:\.[0-9]+)?)\s*(?:kg|kgs)', cleaned_text, re.IGNORECASE)
        height_m = re.search(r'(?:height|ht)[^0-9\n]{0,10}?([0-9]{2,3}(?:\.[0-9]+)?)\s*(?:cm|cms)', cleaned_text, re.IGNORECASE)
        if weight_m:
            extracted['weight'] = {'value': float(weight_m.group(1)), 'confidence': 0.95, 'unit': 'kg', 'matched_text': weight_m.group(0).strip()}
        if height_m:
            extracted['height'] = {'value': float(height_m.group(1)), 'confidence': 0.95, 'unit': 'cm', 'matched_text': height_m.group(0).strip()}

        # 5. BMI (Body Mass Index)
        bmi_val, bmi_match_text = find_param_number([
            r'(?:body\s*mass\s*index|b\.?m\.?i\.?)[^0-9\n]{0,20}?([0-9]{1,2}(?:\.[0-9]+)?)'
        ], min_val=10, max_val=75)
        if bmi_val is not None:
            extracted['bmi'] = {
                'value': bmi_val,
                'confidence': 0.96,
                'unit': 'kg/m²',
                'normal_range': '18.5 - 24.9 kg/m²',
                'matched_text': bmi_match_text.strip(),
                'status': 'Obese' if bmi_val >= 30 else ('Overweight' if bmi_val >= 25 else 'Normal')
            }
        else:
            if weight_m and height_m:
                wt = float(weight_m.group(1))
                ht_m = float(height_m.group(1)) / 100.0
                calc_bmi = round(wt / (ht_m ** 2), 1)
                extracted['bmi'] = {
                    'value': calc_bmi,
                    'confidence': 0.90,
                    'status': 'derived',
                    'rule_id': 'BMI_FROM_WEIGHT_HEIGHT',
                    'source_features': ['weight', 'height'],
                    'unit': 'kg/m²',
                    'normal_range': '18.5 - 24.9 kg/m²',
                    'matched_text': f"Weight {wt}kg, Height {height_m.group(1)}cm -> BMI {calc_bmi}",
                    'status': 'Obese' if calc_bmi >= 30 else ('Overweight' if calc_bmi >= 25 else 'Normal')
                }

        # 5. Age
        age_val, age_match_text = find_param_number([
            r'(?:patient\s*age|age|years\s*old|yrs\s*old)[^0-9\n]{0,15}?([0-9]{1,3})'
        ], min_val=1, max_val=120)
        if age_val is not None:
            extracted['age'] = {
                'value': int(age_val),
                'confidence': 0.98,
                'unit': 'years',
                'matched_text': age_match_text.strip()
            }

        # 6. Sex / Gender
        sex_match = re.search(r'(?:sex|gender)\s*[:=\-]?\s*(male|female|m|f)\b', cleaned_text, re.IGNORECASE)
        if sex_match:
            gender_str = sex_match.group(1).lower()
            is_male = 1 if gender_str in ['male', 'm'] else 0
            extracted['sex'] = {
                'value': is_male,
                'display': 'Male' if is_male == 1 else 'Female',
                'confidence': 0.98,
                'matched_text': sex_match.group(0).strip()
            }

        # 7. Skin Thickness
        skin_val, skin_match_text = find_param_number([
            r'(?:skin\s*thickness|skinfold|triceps\s*skinfold)[^0-9\n]{0,20}?([0-9]{1,2}(?:\.[0-9]+)?)'
        ], min_val=1, max_val=99)
        if skin_val is not None:
            extracted['skin_thickness'] = {
                'value': skin_val,
                'confidence': 0.90,
                'unit': 'mm',
                'matched_text': skin_match_text.strip()
            }

        # 8. Diabetes Pedigree Function / HbA1c
        dpf_val, dpf_match_text = find_param_number([
            r'(?:diabetes\s*pedigree|pedigree\s*function|dpf)[^0-9\n]{0,20}?([0-9]+(?:\.[0-9]+)?)'
        ], min_val=0.01, max_val=3.0)
        if dpf_val is not None:
            extracted['dpf'] = {
                'value': dpf_val,
                'confidence': 0.92,
                'status': 'extracted',
                'matched_text': dpf_match_text.strip()
            }
        else:
            hba1c_val, hba1c_text = find_param_number([
                r'(?:hba1c|glycated\s*hemoglobin)[^0-9\n]{0,20}?([0-9]{1,2}(?:\.[0-9]+)?)'
            ], min_val=3.0, max_val=18.0)
            if hba1c_val is not None:
                dpf_est = round(min(2.5, max(0.1, (hba1c_val - 4.0) * 0.25)), 2)
                extracted['dpf'] = {
                    'value': dpf_est,
                    'confidence': 0.88,
                    'status': 'approximated',
                    'rule_id': 'DPF_FROM_HBA1C_ESTIMATE',
                    'source_features': ['hba1c'],
                    'matched_text': f"HbA1c: {hba1c_val}% -> Estimated Pedigree Score: {dpf_est}"
                }

        # 9. Pregnancies
        preg_val, preg_match_text = find_param_number([
            r'(?:pregnancies|gravida|parity|para)[^0-9\n]{0,15}?([0-9]{1,2})'
        ], min_val=0, max_val=20)
        if preg_val is not None:
            extracted['pregnancies'] = {
                'value': int(preg_val),
                'confidence': 0.92,
                'matched_text': preg_match_text.strip()
            }

        # 10. Serum Cholesterol (chol)
        chol_val, chol_match_text = find_param_number([
            r'(?:total\s*cholesterol|serum\s*cholesterol|cholesterol|chol)[^0-9\n]{0,25}?([0-9]{2,3}(?:\.[0-9]+)?)'
        ], min_val=80, max_val=600)
        if chol_val is not None:
            extracted['chol'] = {
                'value': chol_val,
                'confidence': 0.96,
                'unit': 'mg/dL',
                'normal_range': '< 200 mg/dL',
                'matched_text': chol_match_text.strip(),
                'status': 'High' if chol_val >= 240 else ('Borderline' if chol_val >= 200 else 'Desirable')
            }

        # 11. Heart Rate / Pulse (thalach)
        hr_val, hr_match_text = find_param_number([
            r'(?:max\s*heart\s*rate|maximum\s*heart\s*rate|heart\s*rate|pulse\s*rate|pulse|thalach|hr)[^0-9\n]{0,25}?([0-9]{2,3})'
        ], min_val=40, max_val=250)
        if hr_val is not None:
            extracted['thalach'] = {
                'value': int(hr_val),
                'confidence': 0.94,
                'unit': 'bpm',
                'matched_text': hr_match_text.strip()
            }

        # 12. Fasting Blood Sugar > 120 (fbs)
        if 'glucose' in extracted:
            extracted['fbs'] = {
                'value': 1 if extracted['glucose']['value'] > 120 else 0,
                'confidence': 0.95,
                'status': 'derived',
                'rule_id': 'FBS_FLAG_FROM_GLUCOSE',
                'source_features': ['glucose'],
                'matched_text': f"Derived from Glucose ({extracted['glucose']['value']} mg/dL)"
            }

        # 13. Chest Pain Type (cp)
        if re.search(r'typical\s*angina', cleaned_text, re.IGNORECASE):
            extracted['cp'] = {'value': 0, 'display': 'Typical Angina', 'confidence': 0.9, 'matched_text': 'Typical Angina'}
        elif re.search(r'atypical\s*angina', cleaned_text, re.IGNORECASE):
            extracted['cp'] = {'value': 1, 'display': 'Atypical Angina', 'confidence': 0.9, 'matched_text': 'Atypical Angina'}
        elif re.search(r'non[\s\-]anginal\s*pain', cleaned_text, re.IGNORECASE):
            extracted['cp'] = {'value': 2, 'display': 'Non-anginal Pain', 'confidence': 0.9, 'matched_text': 'Non-anginal Pain'}
        elif re.search(r'asymptomatic|no\s*chest\s*pain', cleaned_text, re.IGNORECASE):
            extracted['cp'] = {'value': 3, 'display': 'Asymptomatic', 'confidence': 0.9, 'matched_text': 'Asymptomatic'}

        # 14. Resting ECG (restecg)
        if re.search(r'left\s*ventricular\s*hypertrophy|lvh', cleaned_text, re.IGNORECASE):
            extracted['restecg'] = {'value': 2, 'display': 'Left ventricular hypertrophy', 'confidence': 0.9, 'matched_text': 'Left ventricular hypertrophy'}
        elif re.search(r'st[\s\-]t\s*wave\s*abnormality|st\s*elevation|t\s*wave\s*inversion', cleaned_text, re.IGNORECASE):
            extracted['restecg'] = {'value': 1, 'display': 'ST-T wave abnormality', 'confidence': 0.9, 'matched_text': 'ST-T wave abnormality'}
        elif re.search(r'ecg\s*normal|normal\s*ecg|normal\s*sinus', cleaned_text, re.IGNORECASE):
            extracted['restecg'] = {'value': 0, 'display': 'Normal', 'confidence': 0.9, 'matched_text': 'Normal ECG'}

        # 15. Exercise Induced Angina (exang)
        if re.search(r'exercise\s*induced\s*angina\s*[:=\-]?\s*(yes|positive|present)', cleaned_text, re.IGNORECASE):
            extracted['exang'] = {'value': 1, 'display': 'Yes', 'confidence': 0.9, 'matched_text': 'Exercise Angina: Yes'}
        elif re.search(r'exercise\s*induced\s*angina\s*[:=\-]?\s*(no|negative|absent)', cleaned_text, re.IGNORECASE):
            extracted['exang'] = {'value': 0, 'display': 'No', 'confidence': 0.9, 'matched_text': 'Exercise Angina: No'}

        # 16. ST Depression (oldpeak)
        oldpeak_val, oldpeak_text = find_param_number([
            r'(?:st\s*depression|oldpeak|st\s*segment\s*depression)[^0-9\n]{0,20}?([0-9]*(?:\.[0-9]+)?)'
        ], min_val=0.0, max_val=10.0)
        if oldpeak_val is not None:
            extracted['oldpeak'] = {
                'value': oldpeak_val,
                'confidence': 0.92,
                'unit': 'mm',
                'matched_text': oldpeak_text.strip()
            }

        # Build disease ready default objects with fallbacks
        diabetes_defaults = {
            'pregnancies': int(extracted.get('pregnancies', {}).get('value', 1 if extracted.get('sex', {}).get('value', 1) == 0 else 0)),
            'glucose': float(extracted.get('glucose', {}).get('value', 110.0)),
            'blood_pressure': float(extracted.get('blood_pressure', {}).get('value', 75.0)),
            'skin_thickness': float(extracted.get('skin_thickness', {}).get('value', 23.0)),
            'insulin': float(extracted.get('insulin', {}).get('value', 85.0)),
            'bmi': float(extracted.get('bmi', {}).get('value', 26.5)),
            'dpf': float(extracted.get('dpf', {}).get('value', 0.47)),
            'age': int(extracted.get('age', {}).get('value', 35))
        }

        heart_defaults = {
            'age': int(extracted.get('age', {}).get('value', 52)),
            'sex': int(extracted.get('sex', {}).get('value', 1)),
            'cp': int(extracted.get('cp', {}).get('value', 0)),
            'trestbps': float(extracted.get('trestbps', {}).get('value', 125.0)),
            'chol': float(extracted.get('chol', {}).get('value', 215.0)),
            'fbs': int(extracted.get('fbs', {}).get('value', 0)),
            'restecg': int(extracted.get('restecg', {}).get('value', 0)),
            'thalach': int(extracted.get('thalach', {}).get('value', 150)),
            'exang': int(extracted.get('exang', {}).get('value', 0)),
            'oldpeak': float(extracted.get('oldpeak', {}).get('value', 0.8)),
            'slope': int(extracted.get('slope', {}).get('value', 1)),
            'ca': int(extracted.get('ca', {}).get('value', 0)),
            'thal': int(extracted.get('thal', {}).get('value', 2))
        }

        return {
            'raw_text': text,
            'line_count': len(lines),
            'extracted_count': len(extracted),
            'parameters': extracted,
            'ready_inputs': {
                'diabetes': diabetes_defaults,
                'heart': heart_defaults
            }
        }
