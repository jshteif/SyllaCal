import os
import google.generativeai as genai
from dotenv import load_dotenv
import PyPDF2
from datetime import date, timedelta    
import uuid
import ast
from flask import Flask, request, jsonify, send_from_directory
import os

weekdays_short = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

app = Flask(__name__)
UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def formatICalendarEvent(event_name, dayList, start_time, end_time, location, num_weeks):
    today = date.today()
    today_format = today.strftime("%Y%m%dT%H%M%S")
    dayListdates = [today + timedelta(days=(day - today.weekday()) % 7) for day in dayList]
    formatted_daydates_start = [daydate.strftime("%Y%m%dT"+start_time) for daydate in dayListdates]
    formatted_daydates_end = [daydate.strftime("%Y%m%dT"+end_time) for daydate in dayListdates]

    return (
        "BEGIN:VCALENDAR\n"
        "VERSION:2.0\n"
        "PRODID:-//Knight Hacks//SyllaCal//EN\n"
        "CALSCALE:GREGORIAN\n"
        "METHOD:PUBLISH\n"
        f"X-WR-CALNAME:{event_name}\n"
        "BEGIN:VTIMEZONE\n"
        "TZID:America/New_York\n"
        "BEGIN:STANDARD\n"
        f"DTSTART:{start_time}\n"
        "TZOFFSETFROM:-0400\n"
        "TZOFFSETTO:-0500\n"
        "TZNAME:EST\n"
        "RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11\n"
        "END:STANDARD\n"
        "BEGIN:DAYLIGHT\n"
        f"DTSTART:{start_time}\n"
        "TZOFFSETFROM:-0500\n"
        "TZOFFSETTO:-0400\n"
        "TZNAME:EDT\n"
        "RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3\n"
        "END:DAYLIGHT\n"
        "END:VTIMEZONE\n"
        "BEGIN:VEVENT\n"
        f"UID:{str(uuid.uuid4())}\n"
        f"DTSTAMP:{today_format}Z\n"
        f"SUMMARY:{event_name}\n"
        f"LOCATION:{location}\n"
        f"DTSTART;TZID=America/New_York:{formatted_daydates_start[0]}\n"
        f"DTEND;TZID=America/New_York:{formatted_daydates_end[0]}\n"
        f"RRULE:FREQ=WEEKLY;BYDAY={','.join([weekdays_short[day] for day in dayList])};COUNT={num_weeks}\n"
        "END:VEVENT\n"
        "END:VCALENDAR\n"
    )

@app.route('/download/<filename>')
def download_ics(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

@app.route('/upload', methods=['POST'])
def upload_pdf():
    load_dotenv()
    try:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    except Exception as e:
        return jsonify({"error": f"Error configuring Google Generative AI: {e}"}), 500

    model = genai.GenerativeModel('gemini-2.0-flash')
    chat = model.start_chat(history=[])

    files = request.files.getlist('file')
    if not files or files[0].filename == '':
        return jsonify({"error": "No files uploaded"}), 400
    results = []
    for file in files:
        if file and file.filename.endswith('.pdf'):
            filepath = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(filepath)
            try:
                pdf_reader = PyPDF2.PdfReader(filepath)
                pdf_text = ""
                for page in pdf_reader.pages:
                    pdf_text += page.extract_text()
                user_input = pdf_text
                if not user_input.strip():
                    results.append({"filename": file.filename, "error": "Empty PDF or no text extracted."})
                    continue
                response = chat.send_message(
                    "Please read this syllabus and find me the days that I have class and where, and the start times and end times on those specific days. Please give your response in the format: "
                    "Class Name; [Day of the Week 1 (e.g., Monday = 0, Sunday = 6), Second Day of the Week (if applicable),... n-th Day of the Week]; Start Time (HHMMSS); End Time (HHMMSS); Location, and Number of Weeks the class meets (try your best to estimate if not specified, e.g. look for a final exam date and compare it to today's date)."
                    "Give each component separately. Don't add anything extra.  Here is the syllabus text: " + user_input,
                    stream=True
                )
                full_response = ""
                for chunk in response:
                    full_response += chunk.text
                array = full_response.split("; ")
                if len(array) < 5:
                    results.append({"filename": file.filename, "error": "Response not in expected format", "response": full_response})
                    continue
                event_name = array[0] + " Lecture"
                try:
                    dayList = ast.literal_eval(array[1])
                    if not isinstance(dayList, list):
                        raise ValueError
                except Exception:
                    results.append({"filename": file.filename, "error": "Could not parse day list", "dayList": array[1]})
                    continue
                start_time = array[2]
                end_time = array[3]
                location = array[4]
                num_weeks = int(array[5]) if len(array) > 5 else 10
                iCal_text = formatICalendarEvent(event_name, dayList, start_time, end_time, location, num_weeks)
                file_name = event_name.replace(" ", "_") + "_Weekly.ics"
                with open(file_name, 'w') as f:
                    f.write(iCal_text)
                results.append({
                    "filename": file.filename,
                    "event_name": event_name,
                    "ical_file": file_name,
                    "ical_text": iCal_text,
                    "response": full_response
                })
            except Exception as e:
                results.append({"filename": file.filename, "error": str(e)})
        else:
            results.append({"filename": file.filename, "error": "Invalid file type"})
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)

