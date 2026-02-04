import { Component, For, Show, createEffect, createSignal } from "solid-js";
import Modal from "./Modal";

export interface PromptField {
    name: string;
    label: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    type?: "text" | "email" | "number" | "url" | "password";
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

const PromptModal: Component<PromptModalProps> = (props) => {
    const [values, setValues] = createSignal<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = createSignal(false);

    createEffect(() => {
        if (props.isOpen) {
            const initial: Record<string, string> = {};
            for (const field of props.fields) {
                initial[field.name] = field.value ?? "";
            }
            setValues(initial);
        }
    });

    const updateValue = (name: string, value: string) => {
        setValues((prev) => ({ ...prev, [name]: value }));
    };

    const canSubmit = () =>
        props.fields.every((field) => !field.required || (values()[field.name] || "").trim().length > 0);

    const handleSubmit = async () => {
        if (!canSubmit() || isSubmitting()) return;
        try {
            setIsSubmitting(true);
            await props.onSubmit(values());
            props.onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={props.isOpen} onClose={props.onClose} title={props.title} size="sm">
            <div class="space-y-4">
                <For each={props.fields}>
                    {(field) => (
                        <div>
                            <label class="block text-xs font-semibold text-ide-text-muted mb-1">
                                {field.label}
                                <Show when={field.required}>
                                    <span class="text-ide-error ml-1">*</span>
                                </Show>
                            </label>
                            <input
                                type={field.type || "text"}
                                class="input w-full"
                                placeholder={field.placeholder}
                                value={values()[field.name] || ""}
                                onInput={(e) => updateValue(field.name, e.currentTarget.value)}
                            />
                            <Show when={field.helperText}>
                                <p class="text-[11px] text-ide-text-muted mt-1">{field.helperText}</p>
                            </Show>
                        </div>
                    )}
                </For>
            </div>

            <div class="flex justify-end gap-2 mt-6">
                <button class="btn-ghost" onClick={props.onClose} disabled={isSubmitting()}>
                    {props.cancelText || "Cancel"}
                </button>
                <button
                    class="px-4 py-2 rounded-lg text-white font-medium bg-ide-accent hover:bg-ide-accent-hover transition-colors disabled:opacity-60"
                    disabled={!canSubmit() || isSubmitting()}
                    onClick={handleSubmit}
                >
                    {props.confirmText || "Confirm"}
                </button>
            </div>
        </Modal>
    );
};

export default PromptModal;
