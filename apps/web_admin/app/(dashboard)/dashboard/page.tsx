import Link from "next/link";
import {Icon} from "@/components/icons";
import {PageHeader} from "@/components/admin-ui";
import {DashboardLive} from "@/components/dashboard-live";
const modules=[["পণ্য","পণ্য, দাম, বারকোড ও স্টক সেটআপ করুন।","/products","products"],["স্টক / ইনভেন্টরি","বর্তমান স্টক, মুভমেন্ট ও সতর্কতা দেখুন।","/inventory","inventory"],["বিক্রয়","দ্রুত POS, পেমেন্ট ও ক্যাশ মেমো।","/sales","sales"],["কাস্টমার","প্রোফাইল, বাকি ও লেজার পরিচালনা করুন।","/customers","customers"]] as const;
export default function DashboardPage(){return <><PageHeader eyebrow="মালিকের সারসংক্ষেপ" title="ড্যাশবোর্ড" description="আপনার ব্যবসার আজকের অবস্থা ও গুরুত্বপূর্ণ সূচক।"/><DashboardLive/><section className="module-section"><div className="section-title"><div><p className="page-eyebrow">অপারেশন</p><h2>ব্যবসার মডিউল</h2></div><p>প্রতিটি তথ্য নির্বাচিত ব্যবসা ও শাখায় সীমাবদ্ধ।</p></div><div className="module-grid">{modules.map(([title,copy,href,icon])=><Link className="module-card" href={href} key={href}><span><Icon name={icon}/></span><div><h3>{title}</h3><p>{copy}</p></div><Icon className="module-arrow" name="arrow"/></Link>)}</div></section></>}
