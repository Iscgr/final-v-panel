#!/bin/bash

# 🌱 Seed Portal Settings via API
# این اسکریپت تنظیمات پورتال را از طریق API به دیتابیس اضافه می‌کند

echo "🌱 شروع seed تنظیمات پورتال..."
echo ""

API_URL="http://127.0.0.1:3000/api/settings"

# آرایه تنظیمات
declare -A SETTINGS=(
  ["portal_header_message"]="برای دریافت جدیدترین نسخه نرم‌افزارهای توصیه شده، لطفاً به انتهای پورتال مراجعه فرمایید 📥"
  ["portal_downloads_intro"]="📱 دانلود اپلیکیشن‌های توصیه شده\n\nبرای استفاده بهینه از سرویس‌ها، نصب نرم‌افزارهای زیر ضروری است:"
  ["portal_guidance_text"]="• برای مشاهده جزئیات هر فاکتور، روی دکمه \"نمایش جزئیات\" کلیک کنید.\n• اعلانات مهم سیستم در بخش \"اعلانات و دانلودها\" نمایش داده می‌شود.\n• برای دانلود اپلیکیشن‌های توصیه شده، از بخش دانلودها استفاده کنید.\n• در صورت وجود هرگونه سوال یا مشکل، با پشتیبانی تماس بگیرید."
  ["portal_contact_phone"]="۰۲۱-۱۲۳۴۵۶۷۸"
  ["portal_contact_email"]="support@example.com"
  ["portal_support_hours"]="شنبه تا چهارشنبه، ۹ صبح تا ۶ عصر"
  ["portal_announcements_title"]="📢 اعلانات و اطلاعیه‌ها"
)

added=0
skipped=0
total=0

for key in "${!SETTINGS[@]}"; do
  total=$((total + 1))
  value="${SETTINGS[$key]}"
  
  # بررسی اینکه آیا تنظیمات موجود است
  existing=$(curl -s "${API_URL}/${key}" 2>/dev/null)
  
  if echo "$existing" | grep -q "\"value\""; then
    echo "⏭️  تنظیمات \"$key\" قبلاً موجود است - نادیده گرفته شد"
    skipped=$((skipped + 1))
  else
    # اضافه کردن تنظیمات جدید
    result=$(curl -s -X PUT "${API_URL}/${key}" \
      -H "Content-Type: application/json" \
      -d "{\"value\":\"$value\"}" 2>/dev/null)
    
    if echo "$result" | grep -q "\"success\":true"; then
      echo "✅ تنظیمات \"$key\" با موفقیت اضافه شد"
      added=$((added + 1))
    else
      echo "❌ خطا در اضافه کردن تنظیمات \"$key\""
    fi
  fi
done

echo ""
echo "📊 خلاصه:"
echo "   ✅ اضافه شده: $added"
echo "   ⏭️  نادیده گرفته شده: $skipped"
echo "   📝 مجموع: $total"
echo ""
echo "🎉 seed تنظیمات پورتال با موفقیت تکمیل شد!"
