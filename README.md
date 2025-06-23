# About
The system serves as an intermediary layer that provides a simplified API interface for [Agni Android application](https://github.com/LatticeInnovations/agni-android) while maintaining full FHIR compliance for data storage and exchange.
## Purpose and Scope
The FHIR facade server acts as a healthcare data management platform that:

- Simplifies FHIR interactions by providing streamlined APIs for common healthcare operations
- Manages complex healthcare workflows including appointments, medications, immunizations, and clinical data
- Ensures data interoperability through FHIR-compliant resource management
- Provides secure access via JWT-based authentication with OTP verification
- Integrates external services for notifications (Twilio, SendGrid) and document management


# 🛠️ Backend Server Setup Guide

This guide will help you set up and run the backend server locally.

# ✅ Prerequisites

- Node.js (v20+ recommended)
- PostgreSQL installed and running
- A running FHIR server (e.g., [HAPI FHIR](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/tree/v6.6.0))
- Setup Twilio sendGrid account and get twilio keys. [click here](https://www.twilio.com/docs/iam/api-keys/keys-in-console)

# 📦 Step-by-Step Setup

## 1. Clone the Repository
- `main` branch is to be used.
```bash
git clone <your-repo-url>
cd <your-project-folder>
```



## 2. Install Dependencies

```bash
npm install
```
#### Install Redis
- Follow below steps if you are using Ubuntu.
- [click here](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/) to know more about redis and how to install it.
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis
sudo systemctl start redis
```

## 3. Create .env File
Create a .env file in the root directory and add the following environment variables:

```
NODE_ENV=local

PORT=3000                                         #change if required
DB_HOST=                                          #Database host
DB_NAME=                                          #Database name
DB_USER=
DB_PASSWORD=                                      #Database name
DB_DIALECT=postgres 
swaggerHost=                                      #Host for API documentation
version=R4
FHIRServerBaseURL=                                #HAPI FHIR server base URL
identifierSystem=http://hospital.smarthealthit.org            #change if required
twilioAccountSid=                                 #twilio accound sid
twilioAuthToken=                                  #twilio auth token
twilioNumber=                                     #twilio number
sendgridKey=                                      #send grid key for email notification
jwtSecretKey=                                     #JWT seccret key
OTPHash=PDJuwb/LgwW                               #update OTP hash
schemaList = ["http:", "https:"],                 
domainsList = ["", "hapi.fhir.org"]               #add all domains
whitelist = ['http://localhost:300', ''];         #add all whitelisted end points   
sctCodeUrl = "http://snomed.info/sct"
prescriptionUrl = "http://hospital.smarthealthit.org/prescriptions"
measureUrl = "http://unitsofmeasure.org"
snUrl = "http://hl7.org/fhir/sid/sn"
orgType = "http://terminology.hl7.org/CodeSystem/organization-type"
fhirCodeUrl = "http://terminology.hl7.org/CodeSystem/v2-0203"
roleCodeUrl = "http://terminology.hl7.org/CodeSystem/v3-RoleCode"
facadeUrl=                                        #add domain name and endpoint of this backend server
bypassNumbers=[]                                  #add mobile numbers to  bypass OTP authentication 
bypassOTP=111111
playstoreNumber=[]
playstoreOTP=
```


> [!NOTE]  
> Ensure your database is created and your FHIR server is up and running before starting the backend.



## 4. Start the Backend Server (Initial Run)
```bash
npm run local
```

This will:

- Start the backend

- Automatically run Sequelize migration files

Once migration completes, stop the server (Ctrl+C).



## 5. Create Resources
- Create Organization resource on FHIR server (organization resource).
- Create Location resource on FHIR server (location resource).
- Create Initial Users (Practitioners, PractitionerRole resources).
- Create Medication List(medication resource).
- Create Symptoms and Diagnosis List (Valueset resource)

# 🧪 You're All Set!
Your backend server is now up and running locally with all dependencies, database, Firebase OTP, and initial FHIR users in place.




