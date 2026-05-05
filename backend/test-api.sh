#!/bin/bash

BASE_URL="http://localhost:3000/api"
PASS=0
FAIL=0
TIMESTAMP=$(date +%s)
DOCTOR_EMAIL="testdoctor_${TIMESTAMP}@test.com"
PATIENT_EMAIL="testpatient_${TIMESTAMP}@test.com"
DOCTOR_TOKEN=""
PATIENT_TOKEN=""
APPOINTMENT_ID=""

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[1;33m'
nc='\033[0m'

check() {
  local description=$1
  local expected=$2
  local actual=$3

  if echo "$actual" | grep -q "$expected"; then
    echo -e "${green}✅ PASS${nc} — $description"
    PASS=$((PASS + 1))
  else
    echo -e "${red}❌ FAIL${nc} — $description"
    echo "   Expected: $expected"
    echo "   Received: $actual"
    FAIL=$((FAIL + 1))
  fi
}

check_absent() {
  local description=$1
  local unexpected=$2
  local actual=$3

  if echo "$actual" | grep -q "$unexpected"; then
    echo -e "${red}❌ FAIL${nc} — $description"
    echo "   Should not contain: $unexpected"
    FAIL=$((FAIL + 1))
  else
    echo -e "${green}✅ PASS${nc} — $description"
    PASS=$((PASS + 1))
  fi
}

echo ""
echo "========================================"
echo "       MidSlot Full API Test Suite"
echo "========================================"

# ─────────────────────────────────────────────
echo ""
echo "── MEDI-4: REGISTER ─────────────────────"
# ─────────────────────────────────────────────

# Valid DOCTOR registration
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"name\":\"Dr. Test\",\"password\":\"123456\",\"role\":\"DOCTOR\"}")
check "Valid DOCTOR registration → should return id" '"id"' "$RES"
check_absent "Register response should not include password" '"password"' "$RES"

# Valid PATIENT registration
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATIENT_EMAIL\",\"name\":\"Test Patient\",\"password\":\"123456\",\"role\":\"PATIENT\"}")
check "Valid PATIENT registration → should return id" '"id"' "$RES"

# Duplicate email
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"name\":\"Dr. Test\",\"password\":\"123456\",\"role\":\"DOCTOR\"}")
check "Duplicate email → 409 message" 'already registered' "$RES"

# Invalid email
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","name":"Test","password":"123456","role":"DOCTOR"}')
check "Invalid email → 400" '"statusCode":400' "$RES"

# Short password
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","name":"Test","password":"123","role":"DOCTOR"}')
check "Short password → 400" '"statusCode":400' "$RES"

# Invalid role
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","name":"Test","password":"123456","role":"ADMIN"}')
check "Invalid role → 400" '"statusCode":400' "$RES"

# Missing name
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","password":"123456","role":"DOCTOR"}')
check "Missing name → 400" '"statusCode":400' "$RES"

# ─────────────────────────────────────────────
echo ""
echo "── MEDI-5: LOGIN ────────────────────────"
# ─────────────────────────────────────────────

# Valid doctor login
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"password\":\"123456\"}")
check "Valid doctor login → should return token" '"token"' "$RES"
check "Valid doctor login → should return user" '"user"' "$RES"
check_absent "Login response must not contain password" '"password"' "$RES"
DOCTOR_TOKEN=$(echo $RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Valid patient login
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATIENT_EMAIL\",\"password\":\"123456\"}")
check "Valid patient login → should return token" '"token"' "$RES"
PATIENT_TOKEN=$(echo $RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Wrong password
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"password\":\"wrong\"}")
check "Wrong password → 401" '"statusCode":401' "$RES"

# Non-existent email
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@nonexistent.com","password":"123456"}')
check "Non-existent email → 401 same message" '"statusCode":401' "$RES"

# Missing password
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\"}")
check "Missing password → 400" '"statusCode":400' "$RES"

# ─────────────────────────────────────────────
echo ""
echo "── MEDI-7: AUTH MIDDLEWARE ──────────────"
# ─────────────────────────────────────────────

# Without token
RES=$(curl -s $BASE_URL/auth/me)
check "Without token /me → 401" 'Authentication required' "$RES"

# Invalid token
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer invalidtoken")
check "Invalid token → 401" 'Invalid or expired token' "$RES"

# Wrong format (Bearer missing)
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: $DOCTOR_TOKEN")
check "Without Bearer → 401" 'Authentication required' "$RES"

# Valid token /me endpoint
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $DOCTOR_TOKEN")
check "Valid token → /me should return user" '"email"' "$RES"
check "DOCTOR should return doctor profile" '"doctor"' "$RES"
check_absent "/me response should not include password" '"password"' "$RES"

# Patient /me → should not have doctor profile
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $PATIENT_TOKEN")
check "Patient /me → should return user" '"email"' "$RES"

# ─────────────────────────────────────────────
echo ""
echo "── MEDI-11: APPOINTMENT STATUS ───────────"
# ─────────────────────────────────────────────

# Without token → update status
RES=$(curl -s -X PATCH $BASE_URL/appointments/any-id/status \
  -H "Content-Type: application/json" \
  -d '{"status":"CANCELLED"}')
check "Without token → 401" 'Authentication required' "$RES"

# Non-existent appointment
RES=$(curl -s -X PATCH $BASE_URL/appointments/fake-9999-9999-9999-999999999999/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DOCTOR_TOKEN" \
  -d '{"status":"CANCELLED"}')
check "Non-existent appointment → 404" 'Appointment not found' "$RES"

# Create test appointment (get doctor id from DB)
DOCTOR_USER_ID=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $DOCTOR_TOKEN" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DOCTOR_USER_ID" ]; then
  echo -e "${yellow}⚠️  SKIP${nc} — Could not retrieve doctor userId, skipping appointment tests"
else
  # Get appointment ids from DB
  APPT_FOR_COMPLETE=$(psql -U postgres -d midslot -t -c \
    "SELECT a.id FROM \"Appointment\" a 
     JOIN \"Doctor\" d ON a.\"doctorId\" = d.id 
     WHERE d.\"userId\" = '$DOCTOR_USER_ID' AND a.status = 'BOOKED' LIMIT 1;" | tr -d ' \n')

  if [ -z "$APPT_FOR_COMPLETE" ]; then
    echo -e "${yellow}⚠️  SKIP${nc} — No BOOKED appointment found for testing, please add one manually"
  else
    # Patient should cancel own appointment
    APPT_FOR_CANCEL=$(psql -U postgres -d midslot -t -c \
      "SELECT a.id FROM \"Appointment\" a 
       JOIN \"Doctor\" d ON a.\"doctorId\" = d.id 
       WHERE d.\"userId\" = '$DOCTOR_USER_ID' AND a.status = 'BOOKED' 
       ORDER BY a.\"createdAt\" DESC LIMIT 1 OFFSET 1;" | tr -d ' \n')

    # Doctor → COMPLETED
    RES=$(curl -s -X PATCH $BASE_URL/appointments/$APPT_FOR_COMPLETE/status \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DOCTOR_TOKEN" \
      -d '{"status":"COMPLETED"}')
    check "Doctor → COMPLETED → 200" '"status":"COMPLETED"' "$RES"
    check_absent "COMPLETED response should not include password" '"password"' "$RES"

    # COMPLETED → change again → 400
    RES=$(curl -s -X PATCH $BASE_URL/appointments/$APPT_FOR_COMPLETE/status \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DOCTOR_TOKEN" \
      -d '{"status":"CANCELLED"}')
    check "COMPLETED → CANCELLED → 400 invalid transition" 'Cannot transition' "$RES"

    if [ -n "$APPT_FOR_CANCEL" ]; then
      # Patient → COMPLETED → 403
      RES=$(curl -s -X PATCH $BASE_URL/appointments/$APPT_FOR_CANCEL/status \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $PATIENT_TOKEN" \
        -d '{"status":"COMPLETED"}')
      check "Patient → COMPLETED → 403 forbidden" 'Only the assigned doctor' "$RES"

      # Doctor → CANCELLED
      RES=$(curl -s -X PATCH $BASE_URL/appointments/$APPT_FOR_CANCEL/status \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DOCTOR_TOKEN" \
        -d '{"status":"CANCELLED"}')
      check "Doctor → CANCELLED → 200 + slot freed" '"status":"CANCELLED"' "$RES"
      check "After CANCELLED → slot isBooked should be false" '"isBooked":false' "$RES"

      # CANCELLED → change again → 400
      RES=$(curl -s -X PATCH $BASE_URL/appointments/$APPT_FOR_CANCEL/status \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DOCTOR_TOKEN" \
        -d '{"status":"CANCELLED"}')
      check "CANCELLED → CANCELLED → 400 invalid transition" 'Cannot transition' "$RES"
    else
      echo -e "${yellow}⚠️  SKIP${nc} — No second BOOKED appointment, some tests skipped"
    fi
  fi
fi

# ─────────────────────────────────────────────
echo ""
echo "========================================"
echo -e "  Total  : $((PASS + FAIL)) tests"
echo -e "  ${green}Passed : $PASS${nc}"
echo -e "  ${red}Failed : $FAIL${nc}"
echo "========================================"
echo ""