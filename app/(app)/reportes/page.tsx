import { GRUPOS, PROCEDIMIENTOS } from "@/lib/procedimientos";
import { Titulo } from "@/components/ui";
import { CatalogoReportes } from "./CatalogoReportes";

export default function Reportes() {
  const reportes = PROCEDIMIENTOS.map(({ id, titulo, descripcion, grupo, funcion, vista }) => ({
    id, titulo, descripcion, grupo, procedimiento: Boolean(funcion), grafica: Boolean(vista),
  }));
  return (
    <>
      <Titulo
        titulo="Reportes"
        subtitulo={`${PROCEDIMIENTOS.length} reportes listos. Elige uno, llena los filtros que necesites y verás los datos en tabla o gráfica; desde ahí puedes agrupar y exportar a Excel.`}
      />
      <CatalogoReportes grupos={[...GRUPOS]} reportes={reportes} />
    </>
  );
}
