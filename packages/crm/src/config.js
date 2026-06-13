export const crmConfig = {
	pipelineStages: [
		{
			key: "LEAD",
			label: "Lead",
			color: "default",
			probability: 10,
			next: ["QUALIFIED"],
		},
		{
			key: "QUALIFIED",
			label: "Qualified",
			color: "info",
			probability: 25,
			next: ["PROPOSAL", "LEAD"],
		},
		{
			key: "PROPOSAL",
			label: "Proposal",
			color: "primary",
			probability: 50,
			next: ["NEGOTIATION", "QUALIFIED"],
		},
		{
			key: "NEGOTIATION",
			label: "Negotiation",
			color: "warning",
			probability: 75,
			next: ["CLOSED_WON", "CLOSED_LOST", "PROPOSAL"],
		},
		{
			key: "CLOSED_WON",
			label: "Closed Won",
			color: "success",
			probability: 100,
			next: [],
		},
		{
			key: "CLOSED_LOST",
			label: "Closed Lost",
			color: "danger",
			probability: 0,
			next: [],
		},
	],
	defaultPageSize: 25,
};
