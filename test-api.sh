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
    echo "   Beklenen : $expected"
    echo "   Gelen    : $actual"
    FAIL=$((FAIL + 1))
  fi
}

check_absent() {
  local description=$1
  local unexpected=$2
  local actual=$3

  if echo "$actual" | grep -q "$unexpected"; then
    echo -e "${red}❌ FAIL${nc} — $description"
    echo "   Bulunmamalıydı: $unexpected"
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
echo "── MEDI-5: REGISTER ─────────────────────"
# ─────────────────────────────────────────────

# Geçerli DOCTOR kaydı
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"name\":\"Dr. Test\",\"password\":\"123456\",\"role\":\"DOCTOR\"}")
check "Geçerli DOCTOR kaydı → id dönmeli" '"id"' "$RES"
check_absent "Register response'da password olmamalı" '"password"' "$RES"

# Geçerli PATIENT kaydı
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATIENT_EMAIL\",\"name\":\"Test Hasta\",\"password\":\"123456\",\"role\":\"PATIENT\"}")
check "Geçerli PATIENT kaydı → id dönmeli" '"id"' "$RES"

# Duplicate email
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"name\":\"Dr. Test\",\"password\":\"123456\",\"role\":\"DOCTOR\"}")
check "Duplicate email → 409 mesajı" 'already registered' "$RES"

# Geçersiz email
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"gecersiz","name":"Test","password":"123456","role":"DOCTOR"}')
check "Geçersiz email → 400" '"statusCode":400' "$RES"

# Kısa şifre
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","name":"Test","password":"123","role":"DOCTOR"}')
check "Kısa şifre → 400" '"statusCode":400' "$RES"

# Geçersiz rol
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","name":"Test","password":"123456","role":"ADMIN"}')
check "Geçersiz rol → 400" '"statusCode":400' "$RES"

# Eksik name
RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","password":"123456","role":"DOCTOR"}')
check "Eksik name → 400" '"statusCode":400' "$RES"

# ─────────────────────────────────────────────
echo ""
echo "── MEDI-5: LOGIN ────────────────────────"
# ─────────────────────────────────────────────

# Geçerli doctor login
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"password\":\"123456\"}")
check "Geçerli doctor login → token dönmeli" '"token"' "$RES"
check "Geçerli doctor login → user dönmeli" '"user"' "$RES"
check_absent "Login response'da password olmamalı" '"password"' "$RES"
DOCTOR_TOKEN=$(echo $RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Geçerli patient login
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATIENT_EMAIL\",\"password\":\"123456\"}")
check "Geçerli patient login → token dönmeli" '"token"' "$RES"
PATIENT_TOKEN=$(echo $RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Yanlış şifre
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"password\":\"yanlis\"}")
check "Yanlış şifre → 401" '"statusCode":401' "$RES"

# Olmayan email
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"yok@yok.com","password":"123456"}')
check "Olmayan email → 401 aynı mesaj" '"statusCode":401' "$RES"

# Eksik şifre
RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\"}")
check "Eksik şifre → 400" '"statusCode":400' "$RES"

# ─────────────────────────────────────────────
echo ""
echo "── MEDI-7: AUTH MIDDLEWARE ──────────────"
# ─────────────────────────────────────────────

# Token olmadan
RES=$(curl -s $BASE_URL/auth/me)
check "Token olmadan /me → 401" 'Authentication required' "$RES"

# Geçersiz token
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer invalidtoken")
check "Geçersiz token → 401" 'Invalid or expired token' "$RES"

# Yanlış format (Bearer eksik)
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: $DOCTOR_TOKEN")
check "Bearer olmadan → 401" 'Authentication required' "$RES"

# Geçerli token ile /me
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $DOCTOR_TOKEN")
check "Geçerli token → /me user dönmeli" '"email"' "$RES"
check "DOCTOR için doctor profili dönmeli" '"doctor"' "$RES"
check_absent "/me response'da password olmamalı" '"password"' "$RES"

# Patient /me → doctor profili olmamalı
RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $PATIENT_TOKEN")
check "Patient /me → user dönmeli" '"email"' "$RES"

# ─────────────────────────────────────────────
echo ""
echo "── MEDI-8: APPOINTMENT STATUS ───────────"
# ─────────────────────────────────────────────

# Token olmadan status güncelleme
RES=$(curl -s -X PATCH $BASE_URL/appointments/herhangi-bir-id/status \
  -H "Content-Type: application/json" \
  -d '{"status":"CANCELLED"}')
check "Token olmadan → 401" 'Authentication required' "$RES"

# Olmayan appointment
RES=$(curl -s -X PATCH $BASE_URL/appointments/yok-1111-1111-1111-111111111111/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DOCTOR_TOKEN" \
  -d '{"status":"CANCELLED"}')
check "Olmayan appointment → 404" 'Appointment not found' "$RES"

# Test appointment oluştur (DB'den doctor id al)
DOCTOR_USER_ID=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $DOCTOR_TOKEN" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DOCTOR_USER_ID" ]; then
  echo -e "${yellow}⚠️  SKIP${nc} — Doctor userId alınamadı, appointment testleri atlanıyor"
else
  # Appointment id'lerini DB'den al
  APPT_FOR_COMPLETE=$(psql -U postgres -d midslot -t -c \
    "SELECT a.id FROM \"Appointment\" a 
     JOIN \"Doctor\" d ON a.\"doctorId\" = d.id 
     WHERE d.\"userId\" = '$DOCTOR_USER_ID' AND a.status = 'BOOKED' LIMIT 1;" | tr -d ' \n')

  if [ -z "$APPT_FOR_COMPLETE" ]; then
    echo -e "${yellow}⚠️  SKIP${nc} — Test için BOOKED appointment bulunamadı, manuel ekleyin"
  else
    # Patient kendi appointment'ını iptal etsin
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
    check_absent "COMPLETED response'da password olmamalı" '"password"' "$RES"

    # COMPLETED → tekrar değiştirme → 400
    RES=$(curl -s -X PATCH $BASE_URL/appointments/$APPT_FOR_COMPLETE/status \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DOCTOR_TOKEN" \
      -d '{"status":"CANCELLED"}')
    check "COMPLETED → CANCELLED → 400 geçersiz transition" 'Cannot transition' "$RES"

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
      check "Doctor → CANCELLED → 200 + slot serbest" '"status":"CANCELLED"' "$RES"
      check "CANCELLED sonrası slot isBooked false olmalı" '"isBooked":false' "$RES"

      # CANCELLED → tekrar → 400
      RES=$(curl -s -X PATCH $BASE_URL/appointments/$APPT_FOR_CANCEL/status \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DOCTOR_TOKEN" \
        -d '{"status":"CANCELLED"}')
      check "CANCELLED → CANCELLED → 400 geçersiz transition" 'Cannot transition' "$RES"
    else
      echo -e "${yellow}⚠️  SKIP${nc} — İkinci BOOKED appointment yok, bazı testler atlandı"
    fi
  fi
fi

# ─────────────────────────────────────────────
echo ""
echo "========================================"
echo -e "  Toplam : $((PASS + FAIL)) test"
echo -e "  ${green}Geçen  : $PASS${nc}"
echo -e "  ${red}Kalan  : $FAIL${nc}"
echo "========================================"
echo ""