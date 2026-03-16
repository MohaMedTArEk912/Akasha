import React from "react";

export const InspectorSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="pt-5 first:pt-2 border-t border-[var(--ide-border)] mt-5 first:mt-0 first:border-0">
        <h4 className="flex items-center justify-between text-[11px] font-semibold text-[var(--ide-text-secondary)] mb-3 px-1 hover:text-white cursor-pointer transition-colors group">
            {title}
            <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        </h4>
        <div className="space-y-2.5 px-1">{children}</div>
    </div>
);

export const PropertyRow: React.FC<{ label: string; children: React.ReactNode; layout?: "row" | "col" }> = ({ label, children, layout = "row" }) => (
    <div className={`flex ${layout === "col" ? "flex-col gap-1.5" : "items-center justify-between gap-3"}`}>
        <label className={`text-[11px] ${layout === "col" ? "text-[var(--ide-text-secondary)]" : "text-[var(--ide-text-muted)] w-1/3"} whitespace-nowrap font-medium hover:text-[var(--ide-text-secondary)] transition-colors cursor-default`}>{label}</label>
        <div className={`${layout === "col" ? "w-full" : "flex-1"} flex justify-end min-w-0`}>{children}</div>
    </div>
);

export const CompactInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 border border-transparent rounded-md px-2 py-1 text-[11px] text-[var(--ide-text)] transition-all outline-none placeholder:text-white/20 font-medium"
    />
);

export const CompactSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <div className="relative w-full">
        <select
            {...props}
            className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 border border-transparent rounded-md pl-2 pr-6 py-1 text-[11px] text-[var(--ide-text)] appearance-none transition-all outline-none font-medium cursor-pointer"
        >
            {props.children}
        </select>
        <svg className="absolute right-2 top-1.5 w-3 h-3 text-[var(--ide-text-muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);
