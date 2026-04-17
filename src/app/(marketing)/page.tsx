"use client";

import Link from "next/link";
import {
  BookOpen,
  MessageSquare,
  Headphones,
  Brain,
  Layers,
  Globe,
  Users,
  Presentation,
  GraduationCap,
  ArrowRight,
  Check,
  ChevronDown,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/stripe";

const features = [
  { icon: BookOpen, title: "Multi-Format Sources", description: "Upload PDFs, DOCX, TXT, CSV, images, URLs, and YouTube videos." },
  { icon: MessageSquare, title: "RAG-Powered Chat", description: "Ask questions grounded in your sources with inline citations." },
  { icon: Headphones, title: "Audio Overviews", description: "Generate podcast-style discussions from your research." },
  { icon: Brain, title: "AI Mind Maps", description: "Visualize connections between concepts automatically." },
  { icon: Presentation, title: "12 Studio Outputs", description: "Slides, infographics, quizzes, flashcards, threads, newsletters, and more." },
  { icon: Globe, title: "Deep Research", description: "Go beyond your sources — search the web and synthesize findings." },
  { icon: Users, title: "Real-Time Collaboration", description: "Work together with live cursors, shared canvas, and presence." },
  { icon: Layers, title: "Infinite Canvas", description: "Spatial organization of research with tldraw." },
  { icon: GraduationCap, title: "Study Tools", description: "Spaced repetition flashcards, quizzes, and mini-courses." },
];

const steps = [
  { number: "1", title: "Upload Sources", description: "Drop PDFs, paste URLs, or add YouTube links." },
  { number: "2", title: "Chat & Explore", description: "Ask questions and get cited answers from your sources." },
  { number: "3", title: "Create & Share", description: "Generate podcasts, slides, study tools, and more." },
];

const faqs = [
  { q: "What sources can I upload?", a: "PDFs, DOCX, TXT, CSV, images (with OCR), web URLs, and YouTube videos." },
  { q: "Is my data private?", a: "Yes. Your sources are encrypted and only accessible to you and collaborators you invite." },
  { q: "Which AI models are available?", a: "Gemini 2.5 Pro/Flash (free), Claude Sonnet/Opus and GPT-4o (Pro/Ultra)." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel your subscription anytime from the billing settings. You keep access until the end of your billing period." },
];

const HomePage = (): React.ReactNode => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">F</span>
            </div>
            <span className="font-semibold">FluxMind</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            Your research,{" "}
            <span className="text-primary">supercharged by AI</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto"
          >
            Upload any source. Chat with AI. Generate podcasts, slides, quizzes, and 10+ output types. Beyond NotebookLM.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-3 justify-center"
          >
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Everything you need for deep research</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-border bg-card p-5"
              >
                <f.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-medium mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold">
                  {step.number}
                </div>
                <h3 className="font-medium mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 bg-muted/30" id="pricing">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">Simple, transparent pricing</h2>
          <p className="text-center text-muted-foreground mb-10">Start free, upgrade when you need more.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(
              ([planId, plan]) => (
                <div
                  key={planId}
                  className={`rounded-xl border p-6 ${
                    planId === "pro"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card"
                  }`}
                >
                  {planId === "pro" && (
                    <p className="text-xs font-medium text-primary mb-2">Most Popular</p>
                  )}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-3xl font-bold mt-2 mb-4">
                    {plan.price === 0 ? "$0" : `$${plan.price / 100}`}
                    {plan.price > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    )}
                  </p>
                  <ul className="space-y-2 mb-6 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {plan.limits.notebooks === -1 ? "Unlimited" : plan.limits.notebooks} notebooks
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {plan.limits.chatPerDay === -1 ? "Unlimited" : plan.limits.chatPerDay} chats/day
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {plan.limits.studioOutputsPerDay === -1 ? "Unlimited" : plan.limits.studioOutputsPerDay} outputs/day
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {plan.limits.deepResearchPerMonth === -1
                        ? "Unlimited deep research"
                        : plan.limits.deepResearchPerMonth === 0
                          ? "No deep research"
                          : `${plan.limits.deepResearchPerMonth} deep research/mo`}
                    </li>
                  </ul>
                  <Link href="/register">
                    <Button
                      className="w-full"
                      variant={planId === "pro" ? "default" : "outline"}
                    >
                      {plan.price === 0 ? "Get Started" : "Start Free Trial"}
                    </Button>
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-border rounded-lg">
                <button
                  className="w-full flex items-center justify-between p-4 text-left text-sm font-medium"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-16 px-4 bg-primary/5 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to supercharge your research?</h2>
          <p className="text-muted-foreground mb-6">Join thousands of researchers, students, and creators.</p>
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FluxMind. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
