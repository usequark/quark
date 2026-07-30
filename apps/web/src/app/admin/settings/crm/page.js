"use client";

import { useCallback, useEffect, useState } from "react";

const STAGE_COLORS = [
	"default",
	"info",
	"primary",
	"warning",
	"success",
	"danger",
];

let stageIdCounter = 0;
const emptyStage = () => ({
	_id: ++stageIdCounter,
	key: "",
	label: "",
	color: "default",
	probability: 0,
	next: [],
});

export default function CrmSettingsPage() {
	const [config, setConfig] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState(null);
	const [changed, setChanged] = useState(false);
	const [fieldsJson, setFieldsJson] = useState("");
	const [fieldsError, setFieldsError] = useState(null);

	useEffect(() => {
		fetch("/api/admin/crm/config")
			.then((r) => r.json())
			.then((res) => {
				const data = res.data;
				setConfig(data);
				setFieldsJson(JSON.stringify(data.fields ?? {}, null, 2));
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
				setMessage({ type: "error", text: "Failed to load CRM config" });
			});
	}, []);

	const patch = useCallback((partial) => {
		setConfig((prev) => (prev ? { ...prev, ...partial } : prev));
		setChanged(true);
	}, []);

	const updateStage = useCallback((index, partial) => {
		setConfig((prev) => {
			if (!prev) return prev;
			const pipelineStages = prev.pipelineStages.map((s, i) =>
				i === index ? { ...s, ...partial } : s,
			);
			return { ...prev, pipelineStages };
		});
		setChanged(true);
	}, []);

	const addStage = useCallback(() => {
		setConfig((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				pipelineStages: [...prev.pipelineStages, emptyStage()],
			};
		});
		setChanged(true);
	}, []);

	const removeStage = useCallback((index) => {
		setConfig((prev) => {
			if (!prev) return prev;
			const removed = prev.pipelineStages[index]?.key;
			const pipelineStages = prev.pipelineStages
				.filter((_, i) => i !== index)
				.map((s) => ({
					...s,
					next: s.next.filter((k) => k !== removed),
				}));
			return { ...prev, pipelineStages };
		});
		setChanged(true);
	}, []);

	const moveStage = useCallback((index, direction) => {
		setConfig((prev) => {
			if (!prev) return prev;
			const target = index + direction;
			if (target < 0 || target >= prev.pipelineStages.length) return prev;
			const pipelineStages = [...prev.pipelineStages];
			const [item] = pipelineStages.splice(index, 1);
			pipelineStages.splice(target, 0, item);
			return { ...prev, pipelineStages };
		});
		setChanged(true);
	}, []);

	const toggleNext = useCallback((stageIndex, nextKey) => {
		setConfig((prev) => {
			if (!prev) return prev;
			const pipelineStages = prev.pipelineStages.map((s, i) => {
				if (i !== stageIndex) return s;
				const has = s.next.includes(nextKey);
				return {
					...s,
					next: has
						? s.next.filter((k) => k !== nextKey)
						: [...s.next, nextKey],
				};
			});
			return { ...prev, pipelineStages };
		});
		setChanged(true);
	}, []);

	const save = useCallback(async () => {
		if (!config) return;
		setSaving(true);
		setMessage(null);
		setFieldsError(null);

		let fields = config.fields;
		try {
			fields = JSON.parse(fieldsJson);
		} catch {
			setFieldsError("Fields JSON is invalid");
			setSaving(false);
			return;
		}

		try {
			const res = await fetch("/api/admin/crm/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					entityLabel: config.entityLabel,
					entityPluralLabel: config.entityPluralLabel,
					containerLabel: config.containerLabel,
					containerPluralLabel: config.containerPluralLabel,
					actorLabel: config.actorLabel,
					actorPluralLabel: config.actorPluralLabel,
					pipelineStages: config.pipelineStages,
					currency: config.currency,
					locale: config.locale,
					defaultPageSize: Number(config.defaultPageSize) || 25,
					fields,
				}),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body?.error?.message || "Save failed");
			}
			const json = await res.json();
			setConfig(json.data);
			setFieldsJson(JSON.stringify(json.data.fields ?? {}, null, 2));
			setMessage({ type: "success", text: "CRM settings saved" });
			setChanged(false);
			setTimeout(() => setMessage(null), 3000);
		} catch (err) {
			setMessage({
				type: "error",
				text: err instanceof Error ? err.message : "Failed to save settings",
			});
		} finally {
			setSaving(false);
		}
	}, [config, fieldsJson]);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	if (!config) {
		return (
			<div className="max-w-3xl mx-auto">
				<p className="text-sm text-danger">Unable to load CRM configuration.</p>
			</div>
		);
	}

	const stageKeys = config.pipelineStages.map((s) => s.key).filter(Boolean);

	return (
		<div className="max-w-3xl mx-auto space-y-8">
			<div>
				<h1 className="text-xl font-semibold text-text">CRM Settings</h1>
				<p className="text-sm text-text-muted mt-1">
					Configure entity labels, pipeline stages, currency, and field
					definitions.
				</p>
			</div>

			{message && (
				<div
					className={`px-4 py-3 rounded-lg text-sm ${
						message.type === "success"
							? "bg-success-muted border border-success/30 text-success"
							: "bg-danger-muted border border-danger/30 text-danger"
					}`}
				>
					{message.text}
				</div>
			)}

			<section className="space-y-4">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-text-faint">
					Entity Labels
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<LabelInput
						label="Entity (singular)"
						value={config.entityLabel}
						onChange={(v) => patch({ entityLabel: v })}
					/>
					<LabelInput
						label="Entity (plural)"
						value={config.entityPluralLabel}
						onChange={(v) => patch({ entityPluralLabel: v })}
					/>
					<LabelInput
						label="Container (singular)"
						value={config.containerLabel}
						onChange={(v) => patch({ containerLabel: v })}
					/>
					<LabelInput
						label="Container (plural)"
						value={config.containerPluralLabel}
						onChange={(v) => patch({ containerPluralLabel: v })}
					/>
					<LabelInput
						label="Actor (singular)"
						value={config.actorLabel}
						onChange={(v) => patch({ actorLabel: v })}
					/>
					<LabelInput
						label="Actor (plural)"
						value={config.actorPluralLabel}
						onChange={(v) => patch({ actorPluralLabel: v })}
					/>
				</div>
			</section>

			<section className="space-y-4">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-text-faint">
					Locale & Display
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<LabelInput
						label="Currency"
						value={config.currency}
						onChange={(v) => patch({ currency: v })}
						placeholder="USD"
					/>
					<LabelInput
						label="Locale"
						value={config.locale}
						onChange={(v) => patch({ locale: v })}
						placeholder="en-US"
					/>
					<LabelInput
						label="Default page size"
						type="number"
						value={String(config.defaultPageSize)}
						onChange={(v) => patch({ defaultPageSize: Number(v) || 25 })}
					/>
				</div>
			</section>

			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold uppercase tracking-widest text-text-faint">
						Pipeline Stages
					</h2>
					<button
						type="button"
						onClick={addStage}
						className="px-3 py-1.5 text-xs font-medium bg-surface-hover text-text border border-border rounded-md hover:bg-surface transition-colors"
					>
						Add stage
					</button>
				</div>

				<div className="space-y-3">
					{config.pipelineStages.map((stage, index) => (
						<div
							key={stage._id || stage.key || index}
							className="p-4 bg-surface border border-border rounded-lg space-y-3"
						>
							<div className="flex items-start gap-2">
								<div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
									<LabelInput
										label="Key"
										value={stage.key}
										onChange={(v) =>
											updateStage(index, {
												key: v.toUpperCase().replace(/\s+/g, "_"),
											})
										}
										placeholder="LEAD"
									/>
									<LabelInput
										label="Label"
										value={stage.label}
										onChange={(v) => updateStage(index, { label: v })}
										placeholder="Lead"
									/>
									<div>
										<label
											htmlFor={`stage-color-${index}`}
											className="block text-xs font-medium text-text-muted mb-1"
										>
											Color
										</label>
										<select
											id={`stage-color-${index}`}
											value={stage.color}
											onChange={(e) =>
												updateStage(index, { color: e.target.value })
											}
											className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-md text-text"
										>
											{STAGE_COLORS.map((c) => (
												<option key={c} value={c}>
													{c}
												</option>
											))}
										</select>
									</div>
									<LabelInput
										label="Probability %"
										type="number"
										value={String(stage.probability)}
										onChange={(v) =>
											updateStage(index, {
												probability: Math.min(100, Math.max(0, Number(v) || 0)),
											})
										}
									/>
								</div>
								<div className="flex flex-col gap-1 shrink-0 pt-5">
									<button
										type="button"
										onClick={() => moveStage(index, -1)}
										disabled={index === 0}
										className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40"
										title="Move up"
									>
										↑
									</button>
									<button
										type="button"
										onClick={() => moveStage(index, 1)}
										disabled={index === config.pipelineStages.length - 1}
										className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40"
										title="Move down"
									>
										↓
									</button>
									<button
										type="button"
										onClick={() => removeStage(index)}
										disabled={config.pipelineStages.length <= 1}
										className="px-2 py-1 text-xs border border-danger/30 text-danger rounded disabled:opacity-40"
										title="Remove"
									>
										×
									</button>
								</div>
							</div>

							<div>
								<p className="text-xs font-medium text-text-muted mb-2">
									Next stages
								</p>
								<div className="flex flex-wrap gap-2">
									{stageKeys
										.filter((k) => k !== stage.key)
										.map((key) => {
											const active = stage.next.includes(key);
											return (
												<button
													key={key}
													type="button"
													onClick={() => toggleNext(index, key)}
													className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
														active
															? "bg-primary text-white border-primary"
															: "bg-surface-hover text-text-muted border-transparent hover:text-text"
													}`}
												>
													{key}
												</button>
											);
										})}
									{stageKeys.filter((k) => k !== stage.key).length === 0 && (
										<span className="text-xs text-text-faint">
											No other stages
										</span>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-text-faint">
					Field Definitions (JSON)
				</h2>
				<p className="text-xs text-text-muted">
					Advanced: edit entity/actor/container field arrays as JSON. Invalid
					JSON will block save.
				</p>
				<textarea
					value={fieldsJson}
					onChange={(e) => {
						setFieldsJson(e.target.value);
						setFieldsError(null);
						setChanged(true);
					}}
					rows={14}
					spellCheck={false}
					className="w-full px-3 py-2 text-xs font-mono bg-bg border border-border rounded-md text-text"
				/>
				{fieldsError && <p className="text-xs text-danger">{fieldsError}</p>}
			</section>

			<div className="flex items-center gap-3 pb-8">
				<button
					type="button"
					onClick={save}
					disabled={saving || !changed}
					className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{saving ? "Saving..." : "Save Changes"}
				</button>
				{changed && (
					<span className="text-xs text-text-muted">
						You have unsaved changes
					</span>
				)}
			</div>
		</div>
	);
}

function LabelInput({ label, value, onChange, type = "text", placeholder }) {
	const inputId = `crm-setting-${label.toLowerCase().replace(/\s+/g, "-")}`;
	return (
		<div>
			<label
				htmlFor={inputId}
				className="block text-xs font-medium text-text-muted mb-1"
			>
				{label}
			</label>
			<input
				id={inputId}
				type={type}
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
				className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-md text-text"
			/>
		</div>
	);
}
