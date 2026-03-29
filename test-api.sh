#!/bin/bash

BASE_URL="http://localhost:3000/api"
PASS=0
FAIL=0
TIMESTAMP=$(date +%s)
DOCTOR_EMAIL="testdoctor_${TIMESTAMP}@test.com"
PATIENT_EMAIL="testpatient_${TIMESTAMP}@test.com"

green='\033[0;32m'
red='\033[0;31m'
nc='\033[0m'

check() {
  local description=$1
  local expected=$2
  local actual=$3

  if echo "$actual" | grep -q "$expected"; then
    echo -e "${green}PASS${nc} — $description"
    PASS=$((PASS + 1))
  else
    echo -e "${red}FAIL${nc} — $description"
    echo "   Beklenen: $expected"
    echo "   Gelen:    $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "========================================"
echo "       MidSlot API Test Suite"
echo "========================================"

# ─── REGISTER ────────────────────────────────

echo ""
echo "── REGISTER ─────────────────────────────"

RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"name\":\"Ali Vural\",\"password\":\"123456\",\"role\":\"DOCTOR\"}")
check "Geçerli DOCTOR kaydı → 201 + id dönmeli" '"id"' "$RES"

if echo "$RES" | grep -q '"password"'; then
  echo -e "${red}FAIL${nc} — Password response'da var!"
  FAIL=$((FAIL+1))
else
  echo -e "${green}PASS${nc} — Password response'da yok"
  PASS=$((PASS+1))
fi

RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"name\":\"Ali Vural\",\"password\":\"123456\",\"role\":\"DOCTOR\"}")
check "Duplicate email → 409 mesajı" 'already registered' "$RES"

RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"gecersiz","password":"123456","role":"DOCTOR"}')
check "Geçersiz email → 400 + field error" '"email"' "$RES"

RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","name":"Test","password":"123","role":"DOCTOR"}')
check "Kısa şifre → 400 + field error" '"password"' "$RES"

RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","name":"Test","password":"123456","role":"ADMIN"}')
check "Geçersiz rol → 400 + field error" '"role"' "$RES"

RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$PATIENT_EMAIL\",\"name\":\"Ayşe Kaya\",\"password\":\"123456\",\"role\":\"PATIENT\"}")
check "Geçerli PATIENT kaydı → 201 + id dönmeli" '"id"' "$RES"

# ─── LOGIN ───────────────────────────────────

echo ""
echo "── LOGIN ────────────────────────────────"

RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"password\":\"123456\"}")
check "Geçerli login → token dönmeli" '"token"' "$RES"
check "Geçerli login → user dönmeli" '"user"' "$RES"

if echo "$RES" | grep -q '"password"'; then
  echo -e "${red}FAIL${nc} — Login'de password var!"
  FAIL=$((FAIL+1))
else
  echo -e "${green}PASS${nc} — Login'de password yok"
  PASS=$((PASS+1))
fi

TOKEN=$(echo $RES | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\",\"password\":\"yanlis\"}")
check "Yanlış şifre → 401" 'Invalid email or password' "$RES"

RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"yok@yok.com","password":"123456"}')
check "Olmayan email → 401 (aynı mesaj)" 'Invalid email or password' "$RES"

RES=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$DOCTOR_EMAIL\"}")
check "Eksik şifre → 400" '"password"' "$RES"

# ─── AUTH MIDDLEWARE ─────────────────────────

echo ""
echo "── AUTH MIDDLEWARE ──────────────────────"

RES=$(curl -s $BASE_URL/auth/me)
check "Token olmadan /me → 401" 'Authentication required' "$RES"

RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer invalidtoken123")
check "Geçersiz token → 401" 'Invalid or expired token' "$RES"

RES=$(curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $TOKEN")
check "Geçerli token → /me user dönmeli" '"email"' "$RES"
check "DOCTOR için doctor profili dönmeli" '"doctor"' "$RES"

if echo "$RES" | grep -q '"password"'; then
  echo -e "${red}FAIL${nc} — /me'de password var!"
  FAIL=$((FAIL+1))
else
  echo -e "${green}PASS${nc} — /me'de password yok"
  PASS=$((PASS+1))
fi

# ─── SONUÇ ───────────────────────────────────

echo ""
echo "========================================"
echo -e "  Toplam: $((PASS + FAIL)) test"
echo -e "  ${green}Geçen: $PASS${nc}"
echo -e "  ${red}Kalan: $FAIL${nc}"
echo "========================================"
echo ""