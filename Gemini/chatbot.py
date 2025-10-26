import os
import google.generativeai as genai
from dotenv import load_dotenv
import PyPDF2
from datetime import date, timedelta    
import uuid
import ast

weekdays_short = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

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

# load environment variables from .env file
load_dotenv()

# set the API key for Google Generative AI
try:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
except Exception as e:
    print(f"Error configuring Google Generative AI: {e}")
    exit(1)

# Creating the Generative Model
model = genai.GenerativeModel('gemini-2.0-flash')

# Start a chat session with no context or history
chat = model.start_chat(history=[])

# Main chat loop
print("Gemini Chatbot is ready! We are using 2.0 Flash version! Type 'exit' to quit.")
print("="*50)


# Get input from the user
syllabus_path = "syllabus.pdf"

# Read PDF file
pdf_reader = PyPDF2.PdfReader(syllabus_path)
pdf_text = ""
# Extract text from all pages
for page in pdf_reader.pages:
    pdf_text += page.extract_text()
user_input = pdf_text

if not user_input.strip():
    print("Please enter a valid message.")
    # Skips to the next iteration if input is empty

#Check if the user wants to exit the chatbot
if user_input.lower() == "exit":
    print("Exiting the chatbot. Goodbye!")
    exit(0)

try:
    #user input is sent to the LLM
    response = chat.send_message("Please read this syllabus and find me the days that I have class and where, and the start times and end times on those specific days. Please give your response in the format: " \
                                "Class Name; [Day of the Week 1 (e.g., Monday = 0, Sunday = 6), Second Day of the Week (if applicable),... n-th Day of the Week]; Start Time (HHMMSS); End Time (HHMMSS); Location, and Number of Weeks the class meets (try your best to estimate if not specified, e.g. look for a final exam date and compare it to today's date)."  \
                                "Give each component separately. Don't add anything extra.  Here is the syllabus text: " + user_input, stream=True)


    # Accumulate the full response from all chunks
    full_response = ""
    for chunk in response:
        full_response += chunk.text

    print("DEBUG: Full response from Gemini:", full_response)  # For debugging

    array = full_response.split("; ")
    if len(array) < 5:
        print("Response not in expected format:", full_response)
    else:
        event_name = array[0] + " Lecture"
        try:
            dayList = ast.literal_eval(array[1])  # Safely parse the list
            if not isinstance(dayList, list):
                raise ValueError
        except Exception:
            print("Could not parse day list:", array[1])
            dayList = []
        start_time = array[2]
        end_time = array[3]
        location = array[4]
        num_weeks = int(array[5]) if len(array) > 5 else 10  # Default to 10 weeks if not provided
        if dayList:
            iCal_text = formatICalendarEvent(event_name, dayList, start_time, end_time, location, num_weeks)

    file_name = event_name.replace(" ", "_") + "_Weekly.ics"
    with open(file_name, 'w') as f:
        f.write(iCal_text)
    print(f"iCalendar file '{file_name}' has been created successfully.")

except Exception as e:
    print(f"An error occurred: {e}")
    print("\n")

