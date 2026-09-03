export type TeamUnit = "Araras" | "Rio Claro";

export type TeamMember = {
  name: string;
  unit: TeamUnit;
};

export const TEAM_MEMBERS: TeamMember[] = [
  { name: "Carol", unit: "Araras" },
  { name: "Lucas", unit: "Araras" },
  { name: "Lyra", unit: "Araras" },
  { name: "Margareth", unit: "Araras" },
  { name: "Maria Carolina", unit: "Araras" },
  { name: "Paulo", unit: "Araras" },
  { name: "Reginaldo", unit: "Araras" },
  { name: "Reinaldo", unit: "Araras" },
  { name: "Yan", unit: "Araras" },
  { name: "Adriel", unit: "Rio Claro" },
  { name: "Carina", unit: "Rio Claro" },
  { name: "Carmem", unit: "Rio Claro" },
  { name: "Carolina", unit: "Rio Claro" },
  { name: "Davi", unit: "Rio Claro" },
  { name: "Jaqueline", unit: "Rio Claro" },
  { name: "Jeovana", unit: "Rio Claro" },
  { name: "João", unit: "Rio Claro" },
  { name: "José Roberto", unit: "Rio Claro" },
  { name: "Lucas", unit: "Rio Claro" },
  { name: "Nathan", unit: "Rio Claro" },
  { name: "Raffaela", unit: "Rio Claro" },
  { name: "San", unit: "Rio Claro" },
  { name: "Thais", unit: "Rio Claro" },
];

const ARARAS_AVISO_MEMBERS = new Set([
  "Carol",
  "Lucas",
  "Lyra",
  "Margareth",
  "Paulo",
  "Reginaldo",
  "Reinaldo",
  "Yan",
]);

const RIO_CLARO_AVISO_MEMBERS = new Set([
  "Adriel",
  "Carina",
  "Davi",
  "Jeovana",
  "José Roberto",
  "Raffaela",
  "San",
]);

export function requiresAvisoConfirmation(member: TeamMember) {
  return member.unit === "Araras"
    ? ARARAS_AVISO_MEMBERS.has(member.name)
    : RIO_CLARO_AVISO_MEMBERS.has(member.name);
}

export const AVISO_TEAM_MEMBERS = TEAM_MEMBERS.filter(
  requiresAvisoConfirmation,
);

export function findTeamMember(name: string, unit: string) {
  return TEAM_MEMBERS.find((member) => member.name === name && member.unit === unit);
}

export function findAvisoTeamMember(name: string, unit: string) {
  return AVISO_TEAM_MEMBERS.find((member) => member.name === name && member.unit === unit);
}
