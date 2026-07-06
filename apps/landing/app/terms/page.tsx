"use client";

import { useLandingI18n } from "@/lib/i18n";

export default function TermsPage() {
  const { locale } = useLandingI18n();
  if (locale === "en") return <main className="container legal"><h1>Terms of Service</h1><p>Last updated: 4 July 2026</p><h2>Pre-launch notice</h2><p>Final licensing, support, acceptable-use, warranty, payment and termination terms require legal approval before public merchant activation.</p><h2>Business records</h2><p>Customers remain responsible for validating accounting, VAT, invoice and regulatory requirements with qualified Bangladesh advisers.</p></main>;
  return <main className="container legal"><h1>সেবার শর্তাবলি</h1><p>সর্বশেষ হালনাগাদ: ৪ জুলাই ২০২৬</p><h2>চালুর আগের বিজ্ঞপ্তি</h2><p>সর্বসাধারণের জন্য ব্যবসায়ী অ্যাকাউন্ট চালুর আগে লাইসেন্স, সহায়তা, গ্রহণযোগ্য ব্যবহার, নিশ্চয়তা, পেমেন্ট এবং অ্যাকাউন্ট বন্ধ করার চূড়ান্ত শর্ত আইনগতভাবে অনুমোদন করতে হবে।</p><h2>ব্যবসায়িক নথি</h2><p>হিসাব, মূল্য সংযোজন কর, চালান এবং প্রযোজ্য আইনগত প্রয়োজনীয়তা বাংলাদেশের যোগ্য পরামর্শকের মাধ্যমে যাচাই করার দায়িত্ব গ্রাহকের।</p></main>;
}
