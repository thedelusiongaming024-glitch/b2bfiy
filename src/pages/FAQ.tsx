import React, { useMemo, useState } from "react";
import { ChevronDown, HelpCircle, MessageSquare, Send, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SiteContent, FaqItem } from "../types";
import { useLanguage } from "../lib/LanguageContext";

interface FAQProps {
  setRoute: (route: string) => void;
  siteContent: SiteContent;
  faqs: FaqItem[];
  onAskQuestion: (payload: { question: string; askedByName?: string; askedByEmail?: string }) => Promise<any>;
}

export default function FAQ({ setRoute, siteContent, faqs, onAskQuestion }: FAQProps) {
  const { t } = useLanguage();

  // Only ever show entries the admin has answered & published — anything
  // still pending review from a customer question stays hidden here.
  const publishedFaqs = useMemo(
    () =>
      [...faqs]
        .filter((f) => f.status === "published")
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)),
    [faqs]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    publishedFaqs.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return ["All", ...Array.from(set)];
  }, [publishedFaqs]);

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [openId, setOpenId] = useState<string | null>(publishedFaqs[0]?.id ?? null);

  const visibleFaqs =
    activeCategory === "All" ? publishedFaqs : publishedFaqs.filter((f) => f.category === activeCategory);

  // Ask-a-question form state
  const [askForm, setAskForm] = useState({ question: "", name: "", email: "" });
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);
  const [askError, setAskError] = useState("");

  const handleAskChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setAskForm({ ...askForm, [e.target.name]: e.target.value });
    if (askError) setAskError("");
  };

  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAskError("");

    if (!askForm.question.trim()) {
      setAskError(t("Please type your question before sending.", "পাঠানোর আগে দয়া করে আপনার প্রশ্নটি লিখুন।"));
      return;
    }

    setAsking(true);
    try {
      await onAskQuestion({
        question: askForm.question.trim(),
        askedByName: askForm.name.trim() || undefined,
        askedByEmail: askForm.email.trim() || undefined,
      });
      setAsked(true);
      setAskForm({ question: "", name: "", email: "" });
    } catch (err) {
      setAskError(
        t(
          "Something went wrong sending your question. Please try again or reach us via WhatsApp.",
          "আপনার প্রশ্নটি পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন বা হোয়াটসঅ্যাপে যোগাযোগ করুন।"
        )
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="bg-transparent min-h-screen py-16 text-left">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-sm font-bold text-[#FF2D2D] uppercase tracking-widest bg-[#FFE8E5] dark:bg-red-950/50 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            {t("FAQ", "প্রশ্নোত্তর")}
          </span>
          <h1 className="text-4xl font-extrabold text-[#101828] dark:text-white tracking-tight sm:text-5xl font-display">
            {t("Frequently Asked Questions")}
          </h1>
          <p className="text-[#475467] dark:text-gray-300 text-base sm:text-lg">
            {t(
              "Answers to what clients most often ask us about services, pricing, and how we work. Can't find yours? Ask us directly below.",
              "সার্ভিস, মূল্য এবং কাজের পদ্ধতি নিয়ে ক্লায়েন্টরা সবচেয়ে বেশি যেসব প্রশ্ন করেন তার উত্তর এখানে। আপনার প্রশ্নটি না পেলে নিচে সরাসরি জিজ্ঞাসা করুন।"
            )}
          </p>
        </div>

        {/* Category filter chips */}
        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer ${
                  activeCategory === cat
                    ? "bg-[#FF2D2D] border-[#FF2D2D] text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 border-[#F2E4E2] dark:border-gray-700 text-[#475467] dark:text-gray-300 hover:border-[#FF2D2D]/40"
                }`}
              >
                {cat === "All" ? t("All Questions", "সব প্রশ্ন") : cat}
              </button>
            ))}
          </div>
        )}

        {/* Accordion list */}
        <div className="space-y-4">
          {visibleFaqs.length === 0 ? (
            <p className="text-gray-400 text-sm italic py-12 text-center bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-[#F2E4E2] dark:border-gray-700">
              {t("No FAQs published yet in this category.", "এই ক্যাটাগরিতে এখনো কোনো প্রশ্নোত্তর প্রকাশিত হয়নি।")}
            </p>
          ) : (
            visibleFaqs.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-white dark:bg-gray-800 border border-[#F2E4E2] dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-bold text-[#101828] dark:text-white">
                      {faq.question}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 w-7 h-7 rounded-full bg-[#FFF7F5] dark:bg-gray-900 border border-[#F2E4E2] dark:border-gray-700 flex items-center justify-center text-[#FF2D2D]"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-xs sm:text-sm text-[#475467] dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Ask a question */}
        <div className="bg-white dark:bg-gray-800 border border-[#F2E4E2] dark:border-gray-700 p-8 md:p-10 rounded-3xl shadow-sm max-w-2xl mx-auto">
          {asked ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-8 rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                {t("Question Received!", "প্রশ্ন গৃহীত হয়েছে!")}
              </h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 max-w-md mx-auto">
                {t(
                  "Thanks for asking. Our team will review it and publish an answer here soon — or reach out directly if you left your contact details.",
                  "প্রশ্ন করার জন্য ধন্যবাদ। আমাদের টিম এটি পর্যালোচনা করে শীঘ্রই এখানে উত্তর প্রকাশ করবে — অথবা আপনি যোগাযোগের তথ্য দিয়ে থাকলে সরাসরি যোগাযোগ করবে।"
                )}
              </p>
              <button
                onClick={() => setAsked(false)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer mx-auto"
              >
                {t("Ask Another Question", "আরেকটি প্রশ্ন করুন")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleAskSubmit} className="space-y-5">
              <div className="border-b border-[#F2E4E2] dark:border-gray-700 pb-4 flex items-center gap-2.5">
                <div className="p-2.5 bg-[#FFE8E5] dark:bg-red-950/50 rounded-xl text-[#FF2D2D]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#101828] dark:text-white">
                    {t("Didn't find your answer?", "আপনার উত্তরটি পাননি?")}
                  </h3>
                  <p className="text-xs text-[#475467] dark:text-gray-300">
                    {t("Ask us anything — we'll review and publish an answer.", "আমাদের যেকোনো প্রশ্ন করুন — আমরা পর্যালোচনা করে উত্তর প্রকাশ করব।")}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#101828] dark:text-gray-200 uppercase">
                  {t("Your Question *", "আপনার প্রশ্ন *")}
                </label>
                <textarea
                  name="question"
                  required
                  rows={3}
                  value={askForm.question}
                  onChange={handleAskChange}
                  placeholder={t("e.g. Do you offer discounts for annual packages?", "যেমন: বার্ষিক প্যাকেজে কি ছাড় পাওয়া যায়?")}
                  className="w-full px-4 py-3 border border-[#F2E4E2] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#FF2D2D] outline-none bg-white dark:bg-gray-900 text-xs text-[#101828] dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#101828] dark:text-gray-200 uppercase">
                    {t("Name (optional)", "নাম (ঐচ্ছিক)")}
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={askForm.name}
                    onChange={handleAskChange}
                    placeholder={t("e.g. Rakib Hossain", "যেমন: রাকিব হোসাইন")}
                    className="w-full px-4 py-3 border border-[#F2E4E2] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#FF2D2D] outline-none bg-white dark:bg-gray-900 text-xs text-[#101828] dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#101828] dark:text-gray-200 uppercase">
                    {t("Email (optional)", "ইমেইল (ঐচ্ছিক)")}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={askForm.email}
                    onChange={handleAskChange}
                    placeholder="e.g. name@company.com"
                    className="w-full px-4 py-3 border border-[#F2E4E2] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#FF2D2D] outline-none bg-white dark:bg-gray-900 text-xs text-[#101828] dark:text-white"
                  />
                </div>
              </div>

              <p className="text-[10px] text-[#475467] dark:text-gray-400">
                {t(
                  "Leave your email if you'd like a direct reply — otherwise we'll publish the answer here for everyone.",
                  "সরাসরি উত্তর পেতে চাইলে ইমেইল দিন — নয়তো আমরা সবার জন্য এখানেই উত্তর প্রকাশ করব।"
                )}
              </p>

              {askError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                  <span>{askError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={asking}
                className="w-full py-4 bg-[#FF2D2D] hover:bg-[#FF5757] disabled:bg-red-400 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>{asking ? t("Sending...", "পাঠানো হচ্ছে...") : t("Submit Question", "প্রশ্ন পাঠান")}</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Still need help? CTA */}
        <div className="text-center space-y-4 pt-4">
          <p className="text-sm text-[#475467] dark:text-gray-300">
            {t("Prefer to talk it through directly?", "সরাসরি কথা বলতে চান?")}
          </p>
          <button
            onClick={() => setRoute("contact")}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-[#101828] hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-[#101828] text-sm font-bold rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <span>{t("Contact")}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
