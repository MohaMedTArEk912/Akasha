import React, { useState, useEffect, useMemo } from "react";
import Modal from "./Modal";

export interface PromptField {
    name: string;
    label: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    type?: "text" | "email" | "number" | "url" | "password" | "select";
    options?: { label: string; value: string }[];
    helperText?: string;
}

interface PromptModalProps {
    isOpen: boolean;
    title: string;
    fields: PromptField[];
    confirmText?: string;
    cancelText?: string;
    onClose: () => void;
    onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

interface FieldError {
    [fieldName: string]: string;
}

// Validation helper functions
function validateEmail(email: string): string | null {
    if (!email.trim()) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? null : "Please enter a valid email address";
}

function validateUrl(url: string): string | null {
    if (!url.trim()) return null;
    try {
        new URL(url);
        return null;
    } catch {
        return "Please enter a valid URL";
    }
}

function validateNumber(num: string): string | null {
    if (!num.trim()) return null;
    return isNaN(Number(num)) ? "Please enter a valid number" : null;
}

const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    title,
    fields,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onClose,
    onSubmit
}) => {
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<FieldError>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initial: Record<string, string> = {};
            for (const field of fields) {
                initial[field.name] = field.value ?? (field.type === 'select' ? field.options?.[0]?.value ?? '' : "");
            }
            setValues(initial);
            setErrors({});
            setTouched({});
        }
    }, [isOpen, fields]);

    // Validate individual field
    const validateField = (field: PromptField, value: string): string | null => {
        if (field.required && !value.trim()) {
            return `${field.label} is required`;
        }
        if (!value.trim()) return null;
        
        if (field.type === "email") return validateEmail(value);
        if (field.type === "url") return validateUrl(value);
        if (field.type === "number") return validateNumber(value);
        
        return null;
    };

    const updateValue = (name: string, value: string) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        
        // Real-time validation
        if (touched[name]) {
            const field = fields.find(f => f.name === name);
            if (field) {
                const error = validateField(field, value);
                setErrors((prev) => ({
                    ...prev,
                    [name]: error || undefined
                }));
            }
        }
    };

    const handleBlur = (fieldName: string) => {
        setTouched((prev) => ({ ...prev, [fieldName]: true }));
        const field = fields.find(f => f.name === fieldName);
        if (field) {
            const error = validateField(field, values[fieldName] || "");
            setErrors((prev) => ({
                ...prev,
                [fieldName]: error || undefined
            }));
        }
    };

    // Validate all fields
    const validateAllFields = (): boolean => {
        const newErrors: FieldError = {};
        for (const field of fields) {
            const error = validateField(field, values[field.name] || "");
            if (error) {
                newErrors[field.name] = error;
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const errorCount = useMemo(() => Object.keys(errors).length, [errors]);

    const canSubmit = errorCount === 0 && fields.every(
        (field) => !field.required || (values[field.name] || "").trim().length > 0
    );

    const handleSubmit = async () => {
        // Validate all fields on submit
        if (!validateAllFields()) return;
        if (isSubmitting) return;
        
        try {
            setIsSubmitting(true);
            await onSubmit(values);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="space-y-6">
                {/* Form-level error summary */}
                {errorCount > 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg animate-fade-in">
                        <p className="text-red-400 text-sm font-semibold">
                            {errorCount} field{errorCount !== 1 ? 's' : ''} need{errorCount !== 1 ? '' : 's'} attention
                        </p>
                    </div>
                )}

                {fields.map((field) => {
                    const fieldError = errors[field.name];
                    const isFieldTouched = touched[field.name];
                    const hasError = isFieldTouched && fieldError;
                    
                    return (
                        <div key={field.name} className="animate-fade-in" style={{ animationDelay: '50ms' }}>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <label className="text-[10px] font-black text-[var(--ide-text-secondary)] uppercase tracking-[0.2em]">
                                    {field.label}
                                    {field.required && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </label>
                            </div>
                            {field.type === "select" ? (
                                <div className="relative group">
                                    <select
                                        className="input-modern w-full"
                                        data-error={hasError ? "true" : undefined}
                                        value={values[field.name] || ""}
                                        onChange={(e) => updateValue(field.name, e.target.value)}
                                        onBlur={() => handleBlur(field.name)}
                                        aria-invalid={hasError}
                                        aria-describedby={hasError ? `${field.name}-error` : undefined}
                                    >
                                        {field.options?.map((opt) => (
                                            <option key={opt.value} value={opt.value} className="bg-[var(--ide-bg-panel)] text-[var(--ide-text)]">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <input
                                    type={field.type || "text"}
                                    className="input-modern w-full"
                                    data-error={hasError ? "true" : undefined}
                                    placeholder={field.placeholder}
                                    value={values[field.name] || ""}
                                    onChange={(e) => updateValue(field.name, e.target.value)}
                                    onBlur={() => handleBlur(field.name)}
                                    aria-invalid={hasError}
                                    aria-describedby={hasError ? `${field.name}-error` : undefined}
                                />
                            )}
                            
                            {/* Error message */}
                            {hasError && (
                                <p id={`${field.name}-error`} className="text-red-400 text-xs mt-2 ml-1 flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    {fieldError}
                                </p>
                            )}

                            {/* Helper text */}
                            {field.helperText && !hasError && (
                                <p className="text-[10px] text-[var(--ide-text-muted)] mt-2 ml-1 italic">{field.helperText}</p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-3 mt-10">
                <button
                    className="flex-1 h-12 rounded-2xl border border-[var(--ide-border)] text-[var(--ide-text-secondary)] font-black text-[10px] uppercase tracking-widest hover:bg-[var(--ide-bg-elevated)] hover:text-[var(--ide-text)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                    onClick={onClose}
                    disabled={isSubmitting}
                >
                    {cancelText}
                </button>
                <button
                    className="flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:bg-gray-600 disabled:opacity-60 disabled:cursor-wait disabled:pointer-events-none shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleSubmit}
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Processing...
                        </>
                    ) : confirmText}
                </button>
            </div>
        </Modal>
    );
};

export default PromptModal;
