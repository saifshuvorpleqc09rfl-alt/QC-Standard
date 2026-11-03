# Fan Standard Android App

এই প্রজেক্টটি আগের FAN Standard Supabase প্রজেক্ট ব্যবহার করে।

- Project URL ও publishable key: app/src/main/assets/www/config.js
- Published standard: public."QC Standard"
- Admin login: Supabase Auth
- Admin অনুমতি: public.qc_admins
- Standard fields: title, category, content, is_published

GitHub Actions workflow: .github/workflows/fan-standard.yml
Build সফল হলে Fan-Standard-APK artifact পাওয়া যাবে।

সতর্কতা: Supabase service_role key কখনো Android অ্যাপে রাখবেন না।
