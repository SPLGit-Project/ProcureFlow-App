import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function generateVisuals() {
    const outputDir = path.resolve('docs/brief_assets');
    fs.mkdirSync(outputDir, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1200, height: 800 },
        deviceScaleFactor: 2 // High-DPI for crisp printing in Word
    });
    const page = await context.newPage();

    // Tailwind CSS via CDN + Inter font
    const headInclude = `
        <head>
            <meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Plus Jakarta Sans', sans-serif; }
                .font-mono { font-family: 'JetBrains Mono', monospace; }
            </style>
        </head>
    `;

    // 1. VISUAL 1: 48-Hour Reservation Lifecycle Workflow
    console.log('Generating Visual 1: Lifecycle Workflow...');
    const html1 = `
    <!DOCTYPE html>
    <html>
    ${headInclude}
    <body class="bg-slate-50 p-6 flex justify-center items-center min-h-screen">
        <div id="target" class="w-[980px] bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <div class="flex items-center justify-between pb-6 border-b border-slate-100">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-slate-900">ProcureFlow 48-Hour Stock Reservation Lifecycle</h2>
                        <p class="text-xs font-medium text-slate-500">End-to-end automated inventory protection and fair-share allocation workflow</p>
                    </div>
                </div>
                <span class="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">AUTOMATED WORKFLOW</span>
            </div>

            <!-- Flow Stages -->
            <div class="mt-8 grid grid-cols-4 gap-4 relative">
                <!-- Step 1 -->
                <div class="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col justify-between relative group hover:border-blue-400 transition-all">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <span class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">1</span>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Requisition</span>
                        </div>
                        <h3 class="font-bold text-slate-800 text-sm mb-1">Requisition Approved</h3>
                        <p class="text-xs text-slate-500 leading-relaxed">Approver gives final sign-off. Stock check verifies supplier availability against latest SOH snapshot.</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-slate-200/60 text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Approval Recorded
                    </div>
                </div>

                <!-- Step 2 -->
                <div class="bg-blue-50/60 rounded-xl p-5 border-2 border-blue-400 flex flex-col justify-between relative shadow-md shadow-blue-500/10">
                    <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-sm">
                        48h CLOCK RUNNING
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <span class="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">HOLDING</span>
                        </div>
                        <h3 class="font-bold text-blue-950 text-sm mb-1">Stock Reserved</h3>
                        <p class="text-xs text-slate-600 leading-relaxed">Requested units are locked into <b>'Reserved'</b> status. Other plants cannot order this stock.</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-blue-200 text-[11px] text-blue-800 font-semibold flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Urgency Badges Live
                    </div>
                </div>

                <!-- Step 3A: Success -->
                <div class="bg-emerald-50/50 rounded-xl p-5 border border-emerald-300 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <span class="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">3A</span>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">SUCCESS</span>
                        </div>
                        <h3 class="font-bold text-emerald-950 text-sm mb-1">Concur PO # Linked</h3>
                        <p class="text-xs text-slate-600 leading-relaxed">Buyer inputs Concur PO # before 48h. Order becomes <b>Active</b>; units shift permanently to <b>'Committed'</b>.</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-emerald-200 text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Delivery Expected
                    </div>
                </div>

                <!-- Step 3B: Expiry -->
                <div class="bg-rose-50/50 rounded-xl p-5 border border-rose-300 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <span class="w-7 h-7 rounded-lg bg-rose-600 text-white font-bold text-xs flex items-center justify-center">3B</span>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded">EXPIRED</span>
                        </div>
                        <h3 class="font-bold text-rose-950 text-sm mb-1">Auto-Cancelled</h3>
                        <p class="text-xs text-slate-600 leading-relaxed">No PO entered within 48h. Order auto-cancels, stock returned to available pool, requester alerted.</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-rose-200 text-[11px] text-rose-800 font-semibold flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Stock Released
                    </div>
                </div>
            </div>

            <!-- Summary callout bar -->
            <div class="mt-6 p-4 bg-slate-900 rounded-xl text-white flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="flex h-3 w-3 relative">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span class="text-xs font-semibold">Continuous Fair-Share Balance:</span>
                    <span class="text-xs text-slate-300">Supplier inventory is automatically safeguarded from ghost reservations 24/7.</span>
                </div>
                <span class="text-[11px] font-mono text-emerald-400 bg-slate-800 px-3 py-1 rounded-md border border-slate-700">pg_cron hourly clean-up active</span>
            </div>
        </div>
    </body>
    </html>
    `;
    await page.setContent(html1);
    await page.waitForLoadState('networkidle');
    const el1 = await page.$('#target');
    await el1?.screenshot({ path: path.join(outputDir, 'lifecycle_workflow.png') });

    // 2. VISUAL 2: In-App UI Badges & Stock Flyout Mockup
    console.log('Generating Visual 2: Countdown Badges & Stock Flyout...');
    const html2 = `
    <!DOCTYPE html>
    <html>
    ${headInclude}
    <body class="bg-slate-50 p-6 flex justify-center items-center min-h-screen">
        <div id="target" class="w-[980px] bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <div class="pb-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-bold text-slate-900">In-App Live UI Indicators & Urgency Tiers</h2>
                    <p class="text-xs text-slate-500 font-medium">Visual indicators shown across PO Detail, Active Requests, and Task Drawer</p>
                </div>
                <span class="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">PROCUREFLOW INTERFACE</span>
            </div>

            <div class="mt-6 grid grid-cols-12 gap-6">
                <!-- Urgency Badges Column -->
                <div class="col-span-5 flex flex-col gap-3">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">Reservation Urgency Tiers</h3>

                    <!-- Normal Badge Card -->
                    <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                            <div class="text-[11px] font-semibold text-slate-500">Tier 1: Normal (&gt; 24h Left)</div>
                            <div class="text-xs font-bold text-slate-800 mt-0.5">Order approved recently</div>
                        </div>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-mono">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            36h 45m left
                        </span>
                    </div>

                    <!-- Warning Badge Card -->
                    <div class="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl flex items-center justify-between">
                        <div>
                            <div class="text-[11px] font-semibold text-amber-700">Tier 2: Priority (12h – 24h Left)</div>
                            <div class="text-xs font-bold text-slate-800 mt-0.5">Concur PO # needed promptly</div>
                        </div>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm shadow-amber-500/20 font-mono">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            18h 12m left
                        </span>
                    </div>

                    <!-- Critical Badge Card -->
                    <div class="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl flex items-center justify-between">
                        <div>
                            <div class="text-[11px] font-semibold text-rose-700">Tier 3: Critical (&lt; 12h Left)</div>
                            <div class="text-xs font-bold text-slate-800 mt-0.5">Auto-cancellation imminent</div>
                        </div>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm shadow-rose-500/30 animate-pulse font-mono">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            4h 32m left
                        </span>
                    </div>
                </div>

                <!-- Stock Flyout Column -->
                <div class="col-span-7">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Live Stock Breakdown Panel (In PO Detail & Requisitioner View)</h3>
                    
                    <div class="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-md">
                        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div>
                                <span class="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">SUPPLIER: HOST LINEN</span>
                                <h4 class="text-sm font-bold text-white">SKU-7721 - Bath Towel White 600gsm</h4>
                            </div>
                            <span class="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                                Healthy Stock
                            </span>
                        </div>

                        <div class="grid grid-cols-4 gap-3 mt-4 text-center">
                            <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                                <span class="text-[10px] text-slate-400 uppercase font-medium block">Baseline SOH</span>
                                <span class="text-base font-bold text-white font-mono">250</span>
                                <span class="text-[9px] text-slate-500 block">Weekly Upload</span>
                            </div>
                            <div class="bg-blue-950/40 p-2.5 rounded-lg border border-blue-800/50">
                                <span class="text-[10px] text-blue-300 uppercase font-medium block">48h Reserved</span>
                                <span class="text-base font-bold text-blue-400 font-mono">-40</span>
                                <span class="text-[9px] text-blue-300/70 block">2 Active Holds</span>
                            </div>
                            <div class="bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/50">
                                <span class="text-[10px] text-amber-300 uppercase font-medium block">In Delivery</span>
                                <span class="text-base font-bold text-amber-400 font-mono">-60</span>
                                <span class="text-[9px] text-amber-300/70 block">With Concur PO #</span>
                            </div>
                            <div class="bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-600/50">
                                <span class="text-[10px] text-emerald-300 uppercase font-bold block">Net Orderable</span>
                                <span class="text-lg font-extrabold text-emerald-400 font-mono">150</span>
                                <span class="text-[9px] text-emerald-300/70 block">Available Now</span>
                            </div>
                        </div>

                        <div class="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            <span>Pack Multiple: <b>10 Units</b></span>
                            <span class="font-mono text-[11px] text-slate-500">Formula: 250 - 40 - 60 = 150</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
    await page.setContent(html2);
    await page.waitForLoadState('networkidle');
    const el2 = await page.$('#target');
    await el2?.screenshot({ path: path.join(outputDir, 'ui_countdown_badges_and_flyout.png') });

    // 3. VISUAL 3: Dynamic Stock Balance Waterfall
    console.log('Generating Visual 3: Stock Waterfall & Formula...');
    const html3 = `
    <!DOCTYPE html>
    <html>
    ${headInclude}
    <body class="bg-slate-50 p-6 flex justify-center items-center min-h-screen">
        <div id="target" class="w-[980px] bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <div class="pb-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-bold text-slate-900">Dynamic Running Stock Calculation Mechanism</h2>
                    <p class="text-xs text-slate-500 font-medium">How weekly supplier spreadsheets stay 100% accurate every day of the week</p>
                </div>
                <span class="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">RUNNING TOTAL FORMULA</span>
            </div>

            <!-- Waterfall Visual -->
            <div class="mt-6 grid grid-cols-4 gap-4">
                <!-- Step 1: Base -->
                <div class="bg-slate-100 rounded-xl p-5 border border-slate-300 relative">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Starting Baseline</span>
                    <h3 class="text-2xl font-black text-slate-900 font-mono">1,000</h3>
                    <p class="text-xs text-slate-600 font-medium mt-1">Supplier Snapshot SOH</p>
                    <div class="mt-4 text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                        Uploaded weekly from supplier stock report.
                    </div>
                </div>

                <!-- Step 2: Minus Reserved -->
                <div class="bg-blue-50 rounded-xl p-5 border border-blue-200 relative">
                    <div class="absolute -top-3 left-4 bg-blue-600 text-white font-mono font-bold text-[11px] px-2 py-0.5 rounded shadow">
                        SUBTRACT (-)
                    </div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">Active Holds</span>
                    <h3 class="text-2xl font-black text-blue-700 font-mono">150</h3>
                    <p class="text-xs text-blue-900 font-medium mt-1">48h Approved Reservations</p>
                    <div class="mt-4 text-[11px] text-blue-800 bg-white/80 p-2.5 rounded-lg border border-blue-200">
                        Temporarily held while awaiting Concur PO #.
                    </div>
                </div>

                <!-- Step 3: Minus Committed -->
                <div class="bg-amber-50 rounded-xl p-5 border border-amber-200 relative">
                    <div class="absolute -top-3 left-4 bg-amber-600 text-white font-mono font-bold text-[11px] px-2 py-0.5 rounded shadow">
                        SUBTRACT (-)
                    </div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">Awaiting Delivery</span>
                    <h3 class="text-2xl font-black text-amber-700 font-mono">250</h3>
                    <p class="text-xs text-amber-900 font-medium mt-1">Committed Active Orders</p>
                    <div class="mt-4 text-[11px] text-amber-800 bg-white/80 p-2.5 rounded-lg border border-amber-200">
                        Concur PO issued; awaiting physical docket receipt.
                    </div>
                </div>

                <!-- Step 4: Net Available -->
                <div class="bg-emerald-50 rounded-xl p-5 border-2 border-emerald-500 relative shadow-lg shadow-emerald-500/10">
                    <div class="absolute -top-3 left-4 bg-emerald-600 text-white font-mono font-bold text-[11px] px-2 py-0.5 rounded shadow">
                        EQUALS (=)
                    </div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">Net Orderable</span>
                    <h3 class="text-2xl font-black text-emerald-700 font-mono">600</h3>
                    <p class="text-xs text-emerald-950 font-bold mt-1">True Available Stock</p>
                    <div class="mt-4 text-[11px] text-emerald-900 bg-emerald-100/70 p-2.5 rounded-lg border border-emerald-300 font-medium">
                        What requesters see as genuinely orderable.
                    </div>
                </div>
            </div>

            <!-- Mathematical Rule Box -->
            <div class="mt-6 bg-slate-900 rounded-xl p-4 text-white flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-mono text-emerald-400 font-bold uppercase">Mathematical Principle:</span>
                    <span class="text-xs text-slate-300 font-mono">Net Available = Max(0, Latest SOH Snapshot - Active 48h Reserved - Unreceived Committed)</span>
                </div>
                <span class="text-[11px] text-slate-400">Zero Ghost Inventory Guarantee</span>
            </div>
        </div>
    </body>
    </html>
    `;
    await page.setContent(html3);
    await page.waitForLoadState('networkidle');
    const el3 = await page.$('#target');
    await el3?.screenshot({ path: path.join(outputDir, 'dynamic_stock_waterfall.png') });

    // 4. VISUAL 4: Stock Reservations Insights Report Preview
    console.log('Generating Visual 4: Insights Report Preview...');
    const html4 = `
    <!DOCTYPE html>
    <html>
    ${headInclude}
    <body class="bg-slate-50 p-6 flex justify-center items-center min-h-screen">
        <div id="target" class="w-[980px] bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <div class="pb-5 border-b border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        PF
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-slate-900">Dynamic Stock & Reservation Insights Report</h2>
                        <p class="text-xs text-slate-500 font-medium">Location: Reporting ➔ Supplier Insights ➔ Stock Reservations</p>
                    </div>
                </div>
                <span class="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">ANALYTICS & AUDIT</span>
            </div>

            <!-- 5 KPI Cards -->
            <div class="grid grid-cols-5 gap-3 mt-6">
                <div class="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <span class="text-[10px] font-bold text-emerald-800 uppercase block">Net Available</span>
                    <span class="text-xl font-black text-emerald-700 font-mono block mt-1">14,250</span>
                    <span class="text-[10px] text-emerald-600 font-semibold">$85,200 total value</span>
                </div>
                <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <span class="text-[10px] font-bold text-blue-800 uppercase block">48h Reserved</span>
                    <span class="text-xl font-black text-blue-700 font-mono block mt-1">1,840</span>
                    <span class="text-[10px] text-blue-600 font-semibold">12 orders holding</span>
                </div>
                <div class="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <span class="text-[10px] font-bold text-amber-800 uppercase block">In Delivery</span>
                    <span class="text-xl font-black text-amber-700 font-mono block mt-1">3,420</span>
                    <span class="text-[10px] text-amber-600 font-semibold">Committed with PO</span>
                </div>
                <div class="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl">
                    <span class="text-[10px] font-bold text-rose-800 uppercase block">Expiring &lt;24h</span>
                    <span class="text-xl font-black text-rose-700 font-mono block mt-1">3 Orders</span>
                    <span class="text-[10px] text-rose-600 font-semibold">Requires buyer action</span>
                </div>
                <div class="p-3.5 bg-slate-100 border border-slate-300 rounded-xl">
                    <span class="text-[10px] font-bold text-slate-700 uppercase block">Auto-Cancelled</span>
                    <span class="text-xl font-black text-slate-800 font-mono block mt-1">4 Orders</span>
                    <span class="text-[10px] text-slate-500 font-semibold">280 units returned</span>
                </div>
            </div>

            <!-- Queue Snapshot -->
            <div class="mt-5 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div class="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-800">Live 48-Hour Reservation Queue</span>
                    <div class="flex gap-1.5">
                        <span class="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">All (12)</span>
                        <span class="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">Critical (1)</span>
                        <span class="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">Warning (2)</span>
                    </div>
                </div>
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
                        <tr>
                            <th class="px-3 py-2">PO Request #</th>
                            <th class="px-3 py-2">Requester / Site</th>
                            <th class="px-3 py-2">Supplier</th>
                            <th class="px-3 py-2 text-right">Reserved Units</th>
                            <th class="px-3 py-2 text-center">Urgency / Remaining</th>
                            <th class="px-3 py-2 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                        <tr class="hover:bg-slate-50/50">
                            <td class="px-3 py-2 font-mono font-bold text-blue-600">POR-202609-000041</td>
                            <td class="px-3 py-2">John Miller • Adelaide Laundry</td>
                            <td class="px-3 py-2 text-slate-600">Host Linen</td>
                            <td class="px-3 py-2 text-right font-mono font-bold">120 units</td>
                            <td class="px-3 py-2 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono">
                                    3h 15m left
                                </span>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Open PO</span>
                            </td>
                        </tr>
                        <tr class="hover:bg-slate-50/50">
                            <td class="px-3 py-2 font-mono font-bold text-blue-600">POR-202609-000044</td>
                            <td class="px-3 py-2">Sarah Jenkins • Melbourne Plant</td>
                            <td class="px-3 py-2 text-slate-600">Simba Global</td>
                            <td class="px-3 py-2 text-right font-mono font-bold">85 units</td>
                            <td class="px-3 py-2 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white font-mono">
                                    14h 40m left
                                </span>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Open PO</span>
                            </td>
                        </tr>
                        <tr class="hover:bg-slate-50/50">
                            <td class="px-3 py-2 font-mono font-bold text-blue-600">POR-202609-000049</td>
                            <td class="px-3 py-2">David Clark • Sydney Laundry</td>
                            <td class="px-3 py-2 text-slate-600">Host Linen</td>
                            <td class="px-3 py-2 text-right font-mono font-bold">200 units</td>
                            <td class="px-3 py-2 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white font-mono">
                                    38h 10m left
                                </span>
                            </td>
                            <td class="px-3 py-2 text-right">
                                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Open PO</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    `;
    await page.setContent(html4);
    await page.waitForLoadState('networkidle');
    const el4 = await page.$('#target');
    await el4?.screenshot({ path: path.join(outputDir, 'reporting_dashboard_preview.png') });

    await browser.close();
    console.log('All 4 visuals successfully generated in docs/brief_assets/!');
}

generateVisuals().catch(console.error);
