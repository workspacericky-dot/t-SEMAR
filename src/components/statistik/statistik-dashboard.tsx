'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, Hourglass } from 'lucide-react';
import { EXAM_STATS, EXAM_ORDER, type ExamKey, type ExamStats } from '@/lib/data/exam-stats';

// Ordinal amber ramp — one hue, monotone lightness, validated with
// scripts/validate_palette.js --ordinal (light end 2.12:1 on white, all
// adjacent steps clear ΔL 0.06). Index 0 = lightest (first/lowest bucket).
const RAMP = ['#e6a647', '#ce871c', '#ab6d17', '#875412', '#683f0d', '#492a09', '#2d1906'];

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex-1 min-w-[7rem] px-5 py-4 first:pl-0 last:pr-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
        </div>
    );
}

function BarChart({ data, unit }: { data: { label: string; count: number }[]; unit: string }) {
    const max = Math.max(...data.map((d) => d.count));
    return (
        <div className="flex items-end gap-2 sm:gap-3 h-52">
            {data.map((d, i) => {
                const pct = max > 0 ? (d.count / max) * 100 : 0;
                return (
                    <div key={d.label} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                        <div className="pointer-events-none absolute -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg z-10">
                            {d.count} {unit}
                        </div>

                        <span className="text-[13px] font-semibold text-slate-700 tabular-nums mb-1.5">
                            {d.count}
                        </span>

                        <div
                            className="w-full max-w-[30px] rounded-t-[4px] transition-[filter] duration-150 group-hover:brightness-110"
                            style={{
                                height: `${Math.max(pct, d.count > 0 ? 3 : 1)}%`,
                                backgroundColor: d.count > 0 ? RAMP[i] : '#e2e8f0',
                            }}
                        />

                        <span className="mt-2.5 text-[11px] font-medium text-slate-400 tabular-nums">
                            {d.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function BoxPlot({ summary }: { summary: NonNullable<ExamStats['summary']> }) {
    const { min, q1, median, q3, max } = summary;
    const scale = (v: number) => `${v}%`; // scores already sit on a 0–100 axis

    return (
        <div className="pt-10 pb-2">
            <div className="relative h-2">
                <div className="absolute inset-y-0 left-0 right-0 my-auto h-px bg-slate-200" />
                <div
                    className="absolute top-0 bottom-0 my-auto h-px bg-slate-300"
                    style={{ left: scale(min), right: `${100 - max}%` }}
                />
                <div
                    className="absolute -top-2.5 h-7 rounded-[3px]"
                    style={{ left: scale(q1), width: `${q3 - q1}%`, backgroundColor: '#f2ddb3' }}
                />
                <div className="absolute -top-2.5 h-7 w-[2px] bg-slate-900" style={{ left: scale(median) }} />
                <div className="absolute -top-1.5 h-4 w-px bg-slate-400" style={{ left: scale(min) }} />
                <div className="absolute -top-1.5 h-4 w-px bg-slate-400" style={{ left: scale(max) }} />
            </div>

            <div className="relative mt-3 h-10 text-[11px] font-medium text-slate-500">
                <span className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ left: scale(min) }}>
                    <span className="tabular-nums text-slate-700 font-semibold">{min.toFixed(2)}</span>Min
                </span>
                <span className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ left: scale(q1) }}>
                    <span className="tabular-nums text-slate-700 font-semibold">{q1.toFixed(2)}</span>Q1
                </span>
                <span className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ left: scale(median) }}>
                    <span className="tabular-nums text-slate-900 font-semibold">{median.toFixed(2)}</span>Median
                </span>
                <span className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ left: scale(q3) }}>
                    <span className="tabular-nums text-slate-700 font-semibold">{q3.toFixed(2)}</span>Q3
                </span>
                <span className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ left: scale(max) }}>
                    <span className="tabular-nums text-slate-700 font-semibold">{max.toFixed(2)}</span>Max
                </span>
            </div>
        </div>
    );
}

function RevealableScores({ scores }: { scores: number[] }) {
    const [revealed, setRevealed] = useState(false);

    return (
        <div>
            <div className="relative mt-6 rounded-xl border border-slate-100">
                <div
                    className={`grid grid-cols-5 sm:grid-cols-8 gap-x-4 gap-y-2.5 p-6 transition-[filter] duration-300 ${revealed ? '' : 'blur-md select-none'
                        }`}
                    aria-hidden={!revealed}
                >
                    {scores.map((score, i) => (
                        <span key={i} className="text-sm text-slate-600 tabular-nums text-right">
                            {score.toFixed(2)}
                        </span>
                    ))}
                </div>

                {!revealed && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50">
                        <button
                            type="button"
                            onClick={() => setRevealed(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-200"
                        >
                            <Eye className="w-4 h-4" /> Tampilkan Nilai
                        </button>
                    </div>
                )}
            </div>

            {revealed && (
                <button
                    type="button"
                    onClick={() => setRevealed(false)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <EyeOff className="w-3.5 h-3.5" /> Sembunyikan kembali
                </button>
            )}
        </div>
    );
}

function ExamTabs({ active, onChange }: { active: ExamKey; onChange: (key: ExamKey) => void }) {
    return (
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 p-1">
            {EXAM_ORDER.map((key) => {
                const exam = EXAM_STATS[key];
                const isActive = key === active;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        {exam.label}
                    </button>
                );
            })}
        </div>
    );
}

function EmptyState({ exam }: { exam: ExamStats }) {
    return (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 px-8 py-16 flex flex-col items-center text-center">
            <div className="w-11 h-11 rounded-full bg-slate-50 flex items-center justify-center">
                <Hourglass className="w-5 h-5 text-slate-400" />
            </div>
            <h2 className="font-serif text-2xl text-slate-950 mt-5">
                Data {exam.label} belum tersedia
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
                Statistik {exam.fullLabel} akan tampil di sini setelah periode ujian selesai dan seluruh
                nilai selesai dikoreksi.
            </p>
        </div>
    );
}

export function StatistikDashboard() {
    const [examKey, setExamKey] = useState<ExamKey>('uts');
    const exam = EXAM_STATS[examKey];

    return (
        <div className="min-h-screen w-full bg-white font-sans text-slate-900">
            {/* Header */}
            <header className="max-w-5xl mx-auto px-6 lg:px-8 pt-8 flex items-center justify-between">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Login
                </Link>
                <div className="flex items-center gap-2.5">
                    <Image src="/logo.png" alt="Logo" width={28} height={28} style={{ width: 'auto', height: '28px' }} />
                    <span className="font-semibold text-base tracking-tight text-slate-900">t-SEMAR</span>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 lg:px-8 pb-24">
                {/* Hero */}
                <section className={`pt-14 pb-16 ${exam.available ? 'border-b border-slate-100' : ''}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800/70">
                        Evaluasi AKIP &middot; {exam.fullLabel} &middot; 2026
                    </p>
                    <h1 className="font-serif text-4xl sm:text-5xl text-slate-950 mt-4 max-w-2xl leading-[1.15]">
                        Dashboard Statistik t-SEMAR
                    </h1>
                    <p className="text-slate-500 text-base mt-4 max-w-xl leading-relaxed">
                        {exam.available
                            ? `Sebaran nilai akhir dari ${exam.n} peserta pelatihan evaluator AKIP Mahkamah Agung RI pada ${exam.fullLabel}, komponen Perencanaan Kinerja.`
                            : `Pilih komponen penilaian untuk melihat sebaran nilai peserta pelatihan evaluator AKIP Mahkamah Agung RI.`}
                    </p>

                    <div className="mt-8">
                        <ExamTabs active={examKey} onChange={setExamKey} />
                    </div>

                    {exam.available && exam.summary && (
                        <div className="mt-10 rounded-2xl border border-slate-200 p-8 sm:p-10">
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                        Rata-rata Nilai Akhir
                                    </p>
                                    <p className="text-6xl sm:text-7xl font-semibold text-slate-900 tabular-nums mt-2 leading-none">
                                        {exam.summary.mean.toFixed(2)}
                                    </p>
                                </div>
                                <div className="flex gap-8 sm:gap-10 sm:pb-1">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Peserta</p>
                                        <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">{exam.n}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Median</p>
                                        <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">{exam.summary.median.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {!exam.available && <EmptyState exam={exam} />}

                {exam.available && exam.summary && (
                    <>
                        {/* Stat ledger row */}
                        <section className="py-10 border-b border-slate-100">
                            <div className="flex flex-wrap divide-x divide-slate-100">
                                <Stat label="Std Dev (Populasi)" value={exam.summary.stdDev.toFixed(2)} />
                                <Stat label="Nilai Minimum" value={exam.summary.min.toFixed(2)} />
                                <Stat label="Kuartil 1 (Q1)" value={exam.summary.q1.toFixed(2)} />
                                <Stat label="Kuartil 3 (Q3)" value={exam.summary.q3.toFixed(2)} />
                                <Stat label="Nilai Maksimum" value={exam.summary.max.toFixed(2)} />
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Sebaran lima angka (min &middot; Q1 &middot; median &middot; Q3 &middot; max) pada skala 0&ndash;100:
                            </p>
                            <BoxPlot summary={exam.summary} />
                        </section>

                        {/* Score range histogram */}
                        {exam.scoreRanges && (
                            <section className="py-14 border-b border-slate-100">
                                <h2 className="font-serif text-2xl text-slate-950">Distribusi Rentang Nilai</h2>
                                <p className="text-sm text-slate-500 mt-1.5 max-w-lg">
                                    Jumlah peserta pada tiap rentang nilai akhir, dari 30&ndash;40 hingga 90&ndash;100.
                                </p>
                                <div className="mt-8">
                                    <BarChart data={exam.scoreRanges} unit="peserta" />
                                </div>
                            </section>
                        )}

                        {/* Grade letter distribution */}
                        {exam.gradeDistribution && (
                            <section className="py-14 border-b border-slate-100">
                                <h2 className="font-serif text-2xl text-slate-950">Distribusi Huruf Mutu</h2>
                                <p className="text-sm text-slate-500 mt-1.5 max-w-lg">
                                    Konversi nilai akhir menjadi huruf mutu, dari E (terendah) hingga A (tertinggi).
                                </p>
                                <div className="mt-8">
                                    <BarChart data={exam.gradeDistribution} unit="peserta" />
                                </div>
                            </section>
                        )}

                        {/* Raw scores — revealable table view */}
                        {exam.rawScores && (
                            <section className="py-14">
                                <h2 className="font-serif text-2xl text-slate-950">Rincian {exam.n} Nilai Peserta</h2>
                                <p className="text-sm text-slate-500 mt-1.5 max-w-lg">
                                    Seluruh nilai akhir individual, diurutkan menaik. Nama peserta tidak ditampilkan
                                    pada laman publik ini.
                                </p>
                                <RevealableScores scores={exam.rawScores} />
                            </section>
                        )}
                    </>
                )}

                {/* CTA back to login */}
                <section className="pt-4 pb-8 flex items-center justify-between rounded-2xl bg-slate-50 px-8 py-8">
                    <div>
                        <p className="font-serif text-xl text-slate-950">Ingin melihat detail nilai Anda?</p>
                        <p className="text-sm text-slate-500 mt-1">Masuk ke akun t-SEMAR untuk melihat hasil evaluasi lengkap Anda.</p>
                    </div>
                    <Link
                        href="/login"
                        className="shrink-0 inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-black text-white font-semibold text-sm shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        Masuk ke Akun <ArrowUpRight className="w-4 h-4" />
                    </Link>
                </section>
            </main>

            <footer className="text-center pb-10">
                <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                    &copy; {new Date().getFullYear()} Ricky Pramoedya Hermawan. All rights reserved.
                </p>
            </footer>
        </div>
    );
}
