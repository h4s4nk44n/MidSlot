#!/bin/bash

BASE_URL="http://localhost:3000/api"
PASS=0
FAIL=0
TIMESTAMP=$(date +%s)
DOC_EMAIL="doc_${TIMESTAMP}@test.com"
PAT_EMAIL="pat_${TIMESTAMP}@test.com"
OTHER_PAT_EMAIL="otherpat_${TIMESTAMP}@test.com"

green='\033[0;32m'
red='\033[0;31m'
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
    echo "   Beklenen: $expected"
    echo "   Gelen:    $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "    Appointments API Test Suite"
echo "========================================"

# Register & Login Doctor
curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOC_EMAIL\",\"name\":\"Dr Test\",\"password\":\"123456\",\"role\":\"DOCTOR\"}" > /dev/null

DOC_RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOC_EMAIL\",\"password\":\"123456\"}")
DOC_TOKEN=$(echo $DOC_RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Register & Login Patient 1
curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PAT_EMAIL\",\"name\":\"Pat Test\",\"password\":\"123456\",\"role\":\"PATIENT\"}" > /dev/null

PAT_RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PAT_EMAIL\",\"password\":\"123456\"}")
PAT_TOKEN=$(echo $PAT_RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Register & Login Patient 2 (Other Patient)
curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$OTHER_PAT_EMAIL\",\"name\":\"Other Pat\",\"password\":\"123456\",\"role\":\"PATIENT\"}" > /dev/null

OTHER_PAT_RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$OTHER_PAT_EMAIL\",\"password\":\"123456\"}")
OTHER_PAT_TOKEN=$(echo $OTHER_PAT_RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Create 2 TimeSlots (one future, one past)
FUTURE_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 1); console.log(d.toISOString().split('T')[0])")
PAST_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() - 1); console.log(d.toISOString().split('T')[0])")

SLOT1_RES=$(curl -s -X POST $BASE_URL/slots \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$FUTURE_DATE\",\"startTime\":\"$FUTURE_DATE""T10:00:00.000Z\",\"endTime\":\"$FUTURE_DATE""T11:00:00.000Z\"}")
SLOT1_ID=$(echo $SLOT1_RES | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -n 1)

SLOT2_RES=$(curl -s -X POST $BASE_URL/slots \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$FUTURE_DATE\",\"startTime\":\"$FUTURE_DATE""T12:00:00.000Z\",\"endTime\":\"$FUTURE_DATE""T13:00:00.000Z\"}")
SLOT2_ID=$(echo $SLOT2_RES | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -n 1)

# Book appointments
APP1_RES=$(curl -s -X POST $BASE_URL/appointments \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"timeSlotId\":\"$SLOT1_ID\",\"notes\":\"Future Appt\"}")
APP1_ID=$(echo $APP1_RES | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4)

APP2_RES=$(curl -s -X POST $BASE_URL/appointments \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"timeSlotId\":\"$SLOT2_ID\",\"notes\":\"Past Appt\"}")
APP2_ID=$(echo $APP2_RES | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4)

# Force the timeSlot to be in the past using Prisma directly so we can test COMPLETED
cat << 'EOF' > update-slot.ts
import { PrismaClient } from "./src/generated/prisma";
const prisma = new PrismaClient();
prisma.timeSlot.update({
  where: { id: process.env.SLOT_ID },
  data: { 
    startTime: new Date(process.env.PAST_DATE + 'T10:00:00.000Z'), 
    endTime: new Date(process.env.PAST_DATE + 'T11:00:00.000Z') 
  }
}).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) });
EOF
SLOT_ID=$SLOT2_ID PAST_DATE=$PAST_DATE npx ts-node update-slot.ts
rm update-slot.ts


# TESTS

echo "── Testing Errors ──"

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP1_ID/status \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"INVALID_STATUS\"}")
check "Invalid status string → 400" 'Invalid status transition' "$RES"

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP1_ID/status \
  -H "Authorization: Bearer $OTHER_PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CANCELLED\"}")
check "Different patient cancels → 403 Not authorized" 'Not authorized' "$RES"

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP1_ID/status \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"COMPLETED\"}")
check "Patient tries to mark COMPLETED → 403" 'Not authorized' "$RES"

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP1_ID/status \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"COMPLETED\"}")
check "Doctor marks future appt as COMPLETED → 400" 'Cannot complete an appointment before it starts' "$RES"

echo "── Testing Success ──"

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP1_ID/status \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CANCELLED\"}")
check "Patient cancels future appt → 200 CANCELLED" '"status":"CANCELLED"' "$RES"

# Check if slot 1 is free
SLOT1_CHECK=$(curl -s -H "Authorization: Bearer $PAT_TOKEN" $BASE_URL/slots?doctorId=$(echo $DOC_RES | grep -o '"doctor":{"id":"[^"]*"' | cut -d'"' -f6) | grep '"isBooked":false' | grep "$SLOT1_ID")
if [ -n "$SLOT1_CHECK" ]; then
    echo -e "${green}✅ PASS${nc} — Cancelled slot is freed"
    PASS=$((PASS+1))
else
    echo -e "${red}❌ FAIL${nc} — Slot not freed!"
    FAIL=$((FAIL+1))
fi

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP1_ID/status \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CANCELLED\"}")
check "Cancel an already CANCELLED appt → 400" 'Invalid status transition' "$RES"

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP2_ID/status \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"COMPLETED\"}")
check "Doctor completes past appt → 200 COMPLETED" '"status":"COMPLETED"' "$RES"

RES=$(curl -s -X PATCH $BASE_URL/appointments/$APP2_ID/status \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"CANCELLED\"}")
check "Doctor cancels COMPLETED appt → 400" 'Invalid status transition' "$RES"

echo "========================================"
echo -e "  Total: $((PASS + FAIL)) tests"
echo -e "  ${green}Pass: $PASS${nc}"
echo -e "  ${red}Fail: $FAIL${nc}"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
