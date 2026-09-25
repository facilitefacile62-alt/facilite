import ModuleFormationCvClient from "./ModuleFormationCvClient";

export const metadata = {
  title: "Module | Formation Rédaction de CV | Facilité",
};

export default async function ModuleFormationCvPage({ params }) {
  const { id } = await params;
  return <ModuleFormationCvClient moduleId={id} />;
}
