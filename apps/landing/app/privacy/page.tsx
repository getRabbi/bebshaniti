"use client";

import { useLandingI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { locale } = useLandingI18n();
  if (locale === "en") return <main className="container legal"><h1>Privacy Policy</h1><p>Last updated: 4 July 2026</p><h2>Scope</h2><p>This is the publication shell for the production privacy policy. Legal approval is required before public merchant onboarding.</p><h2>Current foundation</h2><p>Business data uses organization isolation, role-based access, audit logging and private storage. Service credentials are never shipped to client applications.</p></main>;
  return <main className="container legal"><h1>গোপনীয়তা নীতি</h1><p>সর্বশেষ হালনাগাদ: ৪ জুলাই ২০২৬</p><h2>পরিধি</h2><p>এটি চূড়ান্ত গোপনীয়তা নীতির প্রকাশনা কাঠামো। সর্বসাধারণের জন্য ব্যবসায়ী নিবন্ধন চালুর আগে আইনগত পর্যালোচনা প্রয়োজন।</p><h2>বর্তমান নিরাপত্তা ভিত্তি</h2><p>প্রতিটি ব্যবসার তথ্য আলাদা রাখা, ভূমিকা অনুযায়ী প্রবেশাধিকার, নিরীক্ষা ইতিহাস এবং ব্যক্তিগত নথি সংরক্ষণের ব্যবস্থা তৈরি করা হয়েছে। কোনো গোপন সেবার চাবি ব্যবহারকারীর অ্যাপে পাঠানো হয় না।</p></main>;
}
