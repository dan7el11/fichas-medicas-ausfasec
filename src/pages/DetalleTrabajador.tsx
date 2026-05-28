import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trabajador, EvaluacionMedica } from '../types';

// ============================================================================
// CONSTANTES DE CATÁLOGOS Y MATRIZ FÍSICA
// ============================================================================
const TIPOS_ANTECEDENTES_FAMILIARES = [
  'Enfermedad Cardio-Vascular', 'Enfermedad Metabólica', 'Enfermedad Neurológica',
  'Enfermedad Oncológica', 'Enfermedad Infecciosa', 'Enfermedad Hereditaria / Congénita',
  'Discapacidades', 'Otros'
];

const SISTEMAS = [
  'PIEL - ANEXOS', 'ÓRGANOS DE LOS SENTIDOS', 'RESPIRATORIO', 'CARDIO-VASCULAR',
  'DIGESTIVO', 'GENITO - URINARIO', 'MÚSCULO ESQUELÉTICO', 'ENDOCRINO', 'HEMO LINFÁTICO', 'NERVIOSO'
];

// Matriz de Examen Físico: 9 Filas x 15 Columnas
const FISICO_ROWS = [
  [
    { type: 'reg', rs: 3, txt: '1. PIEL' }, { type: 'sub', txt: 'a. Cicatrices' }, { type: 'chk', code: '1a' },
    { type: 'reg', rs: 3, txt: '3. OÍDO' }, { type: 'sub', txt: 'a. C. aud ext' }, { type: 'chk', code: '3a' },
    { type: 'reg', rs: 4, txt: '5. NARIZ' }, { type: 'sub', txt: 'a. Tabique' }, { type: 'chk', code: '5a' },
    { type: 'reg', rs: 2, txt: '8. TÓRAX' }, { type: 'sub', txt: 'a. Pulmones' }, { type: 'chk', code: '8a' },
    { type: 'reg', rs: 2, txt: '11. PELVIS' }, { type: 'sub', txt: 'a. Pelvis' }, { type: 'chk', code: '11a' }
  ],
  [
    { type: 'sub', txt: 'b. Tatuajes' }, { type: 'chk', code: '1b' },
    { type: 'sub', txt: 'b. Pabellón' }, { type: 'chk', code: '3b' },
    { type: 'sub', txt: 'b. Cornetes' }, { type: 'chk', code: '5b' },
    { type: 'sub', txt: 'b. Parrilla costal' }, { type: 'chk', code: '8b' },
    { type: 'sub', txt: 'b. Genitales' }, { type: 'chk', code: '11b' }
  ],
  [
    { type: 'sub', txt: 'c. Piel faneras' }, { type: 'chk', code: '1c' },
    { type: 'sub', txt: 'c. Tímpanos' }, { type: 'chk', code: '3c' },
    { type: 'sub', txt: 'c. Mucosas' }, { type: 'chk', code: '5c' },
    { type: 'reg', rs: 2, txt: '9. ABDOMEN' }, { type: 'sub', txt: 'a. Vísceras' }, { type: 'chk', code: '9a' },
    { type: 'reg', rs: 3, txt: '12. EXTREM.' }, { type: 'sub', txt: 'a. Vascular' }, { type: 'chk', code: '12a' }
  ],
  [
    { type: 'reg', rs: 5, txt: '2. OJOS' }, { type: 'sub', txt: 'a. Párpados' }, { type: 'chk', code: '2a' },
    { type: 'reg', rs: 5, txt: '4. OROFAR.' }, { type: 'sub', txt: 'a. Labios' }, { type: 'chk', code: '4a' },
    { type: 'sub', txt: 'd. Senos paran.' }, { type: 'chk', code: '5d' },
    { type: 'sub', txt: 'b. Pared abdom.' }, { type: 'chk', code: '9b' },
    { type: 'sub', txt: 'b. Miembros sup.' }, { type: 'chk', code: '12b' }
  ],
  [
    { type: 'sub', txt: 'b. Conjuntivas' }, { type: 'chk', code: '2b' },
    { type: 'sub', txt: 'b. Lengua' }, { type: 'chk', code: '4b' },
    { type: 'reg', rs: 2, txt: '6. CUELLO' }, { type: 'sub', txt: 'a. Tiroides/mas' }, { type: 'chk', code: '6a' },
    { type: 'reg', rs: 3, txt: '10. COLUMNA' }, { type: 'sub', txt: 'a. Flexibilidad' }, { type: 'chk', code: '10a' },
    { type: 'sub', txt: 'c. Miembros inf.' }, { type: 'chk', code: '12c' }
  ],
  [
    { type: 'sub', txt: 'c. Pupilas' }, { type: 'chk', code: '2c' },
    { type: 'sub', txt: 'c. Faringe' }, { type: 'chk', code: '4c' },
    { type: 'sub', txt: 'b. Movilidad' }, { type: 'chk', code: '6b' },
    { type: 'sub', txt: 'b. Desviación' }, { type: 'chk', code: '10b' },
    { type: 'reg', rs: 4, txt: '13. NEUROLÓG.' }, { type: 'sub', txt: 'a. Fuerza' }, { type: 'chk', code: '13a' }
  ],
  [
    { type: 'sub', txt: 'd. Córnea' }, { type: 'chk', code: '2d' },
    { type: 'sub', txt: 'd. Amígdalas' }, { type: 'chk', code: '4d' },
    { type: 'reg', rs: 2, txt: '7. TÓRAX (Cor)' }, { type: 'sub', txt: 'a. Mamas' }, { type: 'chk', code: '7a' },
    { type: 'sub', txt: 'c. Dolor' }, { type: 'chk', code: '10c' },
    { type: 'sub', txt: 'b. Sensibilidad' }, { type: 'chk', code: '13b' }
  ],
  [
    { type: 'sub', txt: 'e. Motilidad' }, { type: 'chk', code: '2e' },
    { type: 'sub', txt: 'e. Dentadura' }, { type: 'chk', code: '4e' },
    { type: 'sub', txt: 'b. Corazón' }, { type: 'chk', code: '7b' },
    { type: 'empty', cs: 3 },
    { type: 'sub', txt: 'c. Marcha' }, { type: 'chk', code: '13c' }
  ],
  [
    // Fila 9: La instrucción abarca las primeras 12 columnas. Luego sigue Reflejos
    { type: 'instr', cs: 12, txt: 'SI EXISTE EVIDENCIA DE PATOLOGÍA MARCAR CON "X" Y DESCRIBIR EN LA SIGUIENTE SECCIÓN COLOCANDO EL NUMERAL' },
    { type: 'sub', txt: 'd. Reflejos' }, { type: 'chk', code: '13d' }
  ]
];

export default function DetalleTrabajador() {
  const { trabajadorId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const evalIdParam = searchParams.get('evalId');

  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionMedica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pestanaActiva, setPestanaActiva] = useState(0);

  useEffect(() => {
    const cargarDatos = async () => {
      if (!trabajadorId) return;
      try {
        const docRef = doc(db, 'trabajadores', trabajadorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setTrabajador({ id: docSnap.id, ...docSnap.data() } as Trabajador);

        const q = query(collection(db, 'evaluaciones'), where('trabajadorId', '==', trabajadorId));
        const snap = await getDocs(q);
        const evals: EvaluacionMedica[] = [];
        snap.forEach((d) => evals.push({ id: d.id, ...d.data() } as EvaluacionMedica));
        evals.sort((a: any, b: any) => {
          const dA = a.fecha?.seconds ? a.fecha.seconds : new Date(a.fecha).getTime() / 1000;
          const dB = b.fecha?.seconds ? b.fecha.seconds : new Date(b.fecha).getTime() / 1000;
          return dB - dA;
        });
        setEvaluaciones(evals);
        if (evalIdParam) {
          const idx = evals.findIndex(e => e.id === evalIdParam);
          if (idx !== -1) setPestanaActiva(idx);
        }
      } catch (error) { console.error("Error:", error); }
      finally { setCargando(false); }
    };
    cargarDatos();
  }, [trabajadorId, evalIdParam]);

  const fmtF = (fecha: any): string => {
    if (!fecha) return '-';
    if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleDateString('es-EC');
    if (fecha instanceof Date) return fecha.toLocaleDateString('es-EC');
    return String(fecha);
  };

  const fmtFH = (fecha: any): string => {
    if (!fecha) return '-';
    const d = fecha.seconds ? new Date(fecha.seconds * 1000) : fecha instanceof Date ? fecha : null;
    return d ? d.toLocaleString('es-EC') : String(fecha);
  };

  const fmtHora = (fecha: any): string => {
    if (!fecha) return '-';
    const d = fecha.seconds ? new Date(fecha.seconds * 1000) : fecha instanceof Date ? fecha : null;
    return d ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '-';
  };

  const hasFisico = (ev: any, code: string) => ev.examenFisicoHallazgos?.some((h:any) => h.codigo === code);

  // ============================================================
  //  GENERADOR PDF SO-RE-38
  // ============================================================
  const generarPDF = () => {
    const ev: any = evaluaciones[pestanaActiva];
    if (!ev || !trabajador) return;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const M = 7;
    const CW = W - M * 2;
    let y = 7;

    const colorPrimario = '#ccccff';
    const colorSecundario = '#ccffcc'; 
    const colorTerciario = '#ccffff';  
    const negro: [number, number, number] = [0, 0, 0];

    const baseStyles = { lineColor: negro, lineWidth: 0.25, fontSize: 6.5, cellPadding: 1.2, textColor: negro };
    const headStyles = { fillColor: colorSecundario, textColor: negro, fontStyle: 'bold' as const, fontSize: 6.5, lineColor: negro, lineWidth: 0.25, cellPadding: 1.2 };

    const checkPage = (needed: number) => {
      if (y + needed > 285) { pdf.addPage(); y = 7; }
    };

    const secHeader = (texto: string, bgColor = colorPrimario) => {
      checkPage(10);
      pdf.setFillColor(bgColor); pdf.setDrawColor(0);
      pdf.rect(M, y, CW, 5, 'FD');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(texto, M + 1.5, y + 3.5);
      y += 5;
    };

    const textoLibre = (texto: string, minH = 8) => {
      pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(texto || '-', CW - 3);
      const h = Math.max(minH, lines.length * 3 + 2);
      checkPage(h + 2);
      pdf.rect(M, y, CW, h, 'S');
      pdf.text(lines, M + 1.5, y + 3);
      y += h;
    };

    // =============== PÁGINA 1 ===============
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [{ content: 'CEM AUSTROGAS', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN PERIÓDICA', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-38', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'MACROPROCESO: PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: 'Página:    1 de 2', styles: { fontSize: 7, halign: 'left' } }]
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    secHeader('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles: headStyles,
      head: [['INSTITUCIÓN DEL SISTEMA', 'RUC', 'CIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']],
      body: [['CEM AUSTROGAS', '190070301001', '4661', 'MEDICINA OCUPACIONAL', ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || '-']],
    });
    y = (pdf as any).lastAutoTable.finalY;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: baseStyles, headStyles: headStyles,
      head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'PUESTO DE TRABAJO (CIUO)']],
      body: [[trabajador.primerApellido, trabajador.segundoApellido || '-', trabajador.primerNombre, trabajador.segundoNombre || '-', trabajador.sexo, trabajador.puestoTrabajo]],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    secHeader('B. MOTIVO DE CONSULTA');
    textoLibre((ev.motivoConsulta || 'ACTUALIZACIÓN DE FICHA OCUPACIONAL').toUpperCase(), 6);
    y += 1;

    secHeader('C. ANTECEDENTES PERSONALES');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'S');
    pdf.text('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS', M + 1.5, y + 3); y += 4;
    textoLibre(ev.antecedentesClinicosQuirurgicos || 'Sin antecedentes relevantes reportados.', 5);

    if (ev.habitosToxicos && ev.habitosToxicos.length > 0) {
      checkPage(20);
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['CONSUMOS NOCIVOS', 'SI', 'NO', 'TIEMPO CONSUMO', 'CANTIDAD', 'EX CONSUMIDOR', 'TIEMPO ABSTINENCIA']],
        body: ev.habitosToxicos.map((h: any) => [h.tipo.toUpperCase(), h.consume ? 'X' : '', h.consume ? '' : 'X', h.tiempoConsumo || '-', h.cantidad || '-', h.exConsumidor ? 'X' : '', h.tiempoAbstinencia || '-']),
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 5: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }

    if (ev.estiloVida) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['ESTILO DE VIDA', 'SI', 'NO', '¿CUÁL?', 'TIEMPO / CANTIDAD']],
        body: [
          ['ACTIVIDAD FÍSICA', ev.estiloVida.actividadFisica ? 'X' : '', ev.estiloVida.actividadFisica ? '' : 'X', ev.estiloVida.tipoActividad || '-', ev.estiloVida.tiempoCantidad || '-'],
          ['MEDICACIÓN HABITUAL', ev.estiloVida.medicacionHabitual ? 'X' : '', ev.estiloVida.medicacionHabitual ? '' : 'X', ev.estiloVida.medicacionHabitual || '-', ev.estiloVida.medicacionCantidad || '-']
        ],
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }
    y += 1;

    secHeader('INCIDENTES, ACCIDENTES Y ENFERMEDAD PROFESIONAL', colorTerciario);
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario },
      head: [['INCIDENTES LABORALES REPORTADOS']], body: [[ev.incidentes || 'NINGUNO']],
    });
    y = (pdf as any).lastAutoTable.finalY;

    if (ev.accidentesTrabajo?.descripcion) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario },
        head: [['DESCRIPCIÓN DEL ACCIDENTE DE TRABAJO', 'CALIFICADO IESS', 'ESPECIFICACIÓN', 'OBSERVACIONES']],
        body: [[ev.accidentesTrabajo.descripcion, ev.accidentesTrabajo.calificado ? 'SÍ' : 'NO', ev.accidentesTrabajo.especificacion || '-', ev.accidentesTrabajo.observaciones || '-']],
        columnStyles: { 1: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }

    if (ev.enfermedadesProfesionales?.descripcion) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fillColor: colorSecundario },
        head: [['DESCRIPCIÓN DE ENFERMEDAD PROFESIONAL', 'CALIFICADA IESS', 'ESPECIFICACIÓN', 'OBSERVACIONES']],
        body: [[ev.enfermedadesProfesionales.descripcion, ev.enfermedadesProfesionales.calificada ? 'SÍ' : 'NO', ev.enfermedadesProfesionales.especificacion || '-', ev.enfermedadesProfesionales.observaciones || '-']],
        columnStyles: { 1: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }
    y += 2;

    // --- D. ANTECEDENTES FAMILIARES ---
    checkPage(30);
    secHeader('D. ANTECEDENTES FAMILIARES');
    const dBody: any[][] = [];
    for (let r = 0; r < 2; r++) {
      const row: any[] = [];
      for (let c = 0; c < 4; c++) {
        const idx = r * 4 + c;
        const tipo = TIPOS_ANTECEDENTES_FAMILIARES[idx];
        const hasIt = ev.antecedentesFamiliares?.find((a:any) => a.tipo === tipo);
        row.push({ content: `${idx + 1}. ${tipo}`, styles: { fillColor: colorTerciario } });
        row.push({ content: hasIt ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } });
      }
      dBody.push(row);
    }
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 5.5, cellPadding: 1 },
      body: dBody, columnStyles: { 1: { cellWidth: 4 }, 3: { cellWidth: 4 }, 5: { cellWidth: 4 }, 7: { cellWidth: 4 } }
    });
    y = (pdf as any).lastAutoTable.finalY;

    if (ev.antecedentesFamiliares && ev.antecedentesFamiliares.length > 0) {
      const lineasFam = ev.antecedentesFamiliares.map((af: any) => `${af.tipo} (${af.parentesco}): ${af.descripcion || '-'}`).join('; ');
      textoLibre(lineasFam, 5); y += 1;
    } else { textoLibre('No se refieren antecedentes familiares de importancia.', 5); y += 1; }

    // E. FACTORES DE RIESGO
    if (ev.factoresRiesgo) {
      checkPage(25); secHeader('E. FACTORES DE RIESGOS DEL PUESTO DE TRABAJO');
      const fr = ev.factoresRiesgo;
      autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 }, head: [['PUESTO DE TRABAJO / ÁREA', 'ACTIVIDADES', 'TIEMPO DE TRABAJO (MESES)']], body: [[fr.puestoArea || trabajador.puestoTrabajo, fr.actividades || '-', fr.tiempoTrabajoMeses || '-']] });
      y = (pdf as any).lastAutoTable.finalY;
      const categorias = [
        { nombre: 'FÍSICO', items: fr.fisicos || [] }, { nombre: 'MECÁNICO', items: fr.mecanicos || [] },
        { nombre: 'QUÍMICO', items: fr.quimicos || [] }, { nombre: 'BIOLÓGICO', items: fr.biologicos || [] },
        { nombre: 'ERGONÓMICO', items: fr.ergonomicos || [] }, { nombre: 'PSICOSOCIAL', items: fr.psicosociales || [] },
      ].filter(c => c.items.length > 0);
      if (categorias.length > 0) {
        autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6 }, headStyles: { ...headStyles, fontSize: 5.5 }, head: [['CATEGORÍA', 'FACTORES DE RIESGO IDENTIFICADOS']], body: categorias.map(c => [c.nombre, c.items.join(', ')]), columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } } });
        y = (pdf as any).lastAutoTable.finalY;
      }
      y += 2;
    }

    // =============== PÁGINA 2 ===============
    pdf.addPage(); y = 7;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 8 }, columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [{ content: 'CEM AUSTROGAS', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } }, { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN PERIÓDICA', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } }, { content: 'Código:   SO-RE-38', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [{ content: 'PROCESO: GESTIÓN DE SEGURIDAD INDUSTRIAL Y MEDICINA OCUPACIONAL', styles: { fontSize: 6, fontStyle: 'bold' } }, { content: 'Página:    2 de 2', styles: { fontSize: 7, halign: 'left' } }]
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    secHeader('F. ENFERMEDAD ACTUAL');
    textoLibre(ev.enfermedadActual || 'PACIENTE ASINTOMÁTICO AL MOMENTO DE LA VALORACIÓN.', 8); y += 1;

    // --- G. REVISIÓN DE ÓRGANOS Y SISTEMAS ---
    secHeader('G. REVISIÓN DE ÓRGANOS Y SISTEMAS');
    const gBody: any[][] = [];
    for (let r = 0; r < 2; r++) {
      const row: any[] = [];
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        const sysName = SISTEMAS[idx];
        const isChecked = ev.revisionSistemasSeleccionados?.includes(sysName);
        row.push({ content: `${idx + 1}. ${sysName}`, styles: { fillColor: colorTerciario } });
        row.push({ content: isChecked ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } });
      }
      gBody.push(row);
    }
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 5.5, cellPadding: 1 },
      body: gBody, columnStyles: { 1: { cellWidth: 4 }, 3: { cellWidth: 4 }, 5: { cellWidth: 4 }, 7: { cellWidth: 4 }, 9: { cellWidth: 4 } }
    });
    y = (pdf as any).lastAutoTable.finalY;

    if (ev.revisionSistemasSeleccionados && ev.revisionSistemasSeleccionados.length > 0) {
      const sistemasAfectados = ev.revisionSistemasSeleccionados
        .map((s: string) => `${SISTEMAS.indexOf(s) + 1}. ${s}`)
        .sort((a: string, b: string) => parseInt(a) - parseInt(b))
        .join('\n');
      textoLibre(`${sistemasAfectados}\nDescripción: ${ev.revisionSistemasDescripcion || '-'}`, 8);
    } else { 
      textoLibre('Paciente no refiere síntomas adicionales.', 5); 
    }
    y += 1;

    secHeader('H. CONSTANTES VITALES Y ANTROPOMETRÍA');
    const sv = ev.signosVitales || {};
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 7 }, headStyles: { ...headStyles, fontSize: 5.5, halign: 'center' },
      head: [['PRESIÓN\nARTERIAL\n(mmHg)', 'TEMP.\n(°C)', 'FREC.\nCARDÍACA\n(Lat/min)', 'SAT. DE\nOXÍGENO\n(O₂%)', 'FREC.\nRESP.\n(fr/min)', 'PESO\n(Kg)', 'TALLA\n(cm)', 'IMC\n(Kg/m²)', 'PERÍM.\nABD.\n(cm)']],
      body: [[`${sv.presionSistolica || '-'}/${sv.presionDiastolica || '-'}`, sv.temperatura || '-', sv.frecuenciaCardiaca || '-', sv.saturacion || '-', sv.frecuenciaRespiratoria || '-', sv.peso || '-', sv.talla || '-', sv.imc || '-', sv.perimetroAbdominal || '-']],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // --- I. EXAMEN FÍSICO REGIONAL (Con texto rotado arreglado y celda unida al final) ---
    checkPage(60);
    secHeader('I. EXAMEN FÍSICO REGIONAL');
    
    const pdfFisicoRows = FISICO_ROWS.map(row => {
      return row.map(cell => {
        if (cell.type === 'reg') return { content: '', textToRotate: cell.txt, rowSpan: cell.rs, styles: { fillColor: colorTerciario, halign: 'center', valign: 'middle' } };
        if (cell.type === 'sub') return { content: cell.txt, styles: { fillColor: '#ffffff' } };
        if (cell.type === 'chk') return { content: hasFisico(ev, cell.code as string) ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: '#ffffff' } };
        if (cell.type === 'empty') return { content: '', rowSpan: cell.rs || 1, colSpan: cell.cs || 1, styles: { fillColor: '#ffffff', lineWidth: 0 } };
        if (cell.type === 'instr') return { content: cell.txt, colSpan: cell.cs, styles: { fillColor: '#f8f8f8', textColor: negro, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 5.5 } };
        return { content: '' };
      });
    });

    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, fontSize: 5.5, cellPadding: 0.8 },
      bodyStyles: { minCellHeight: 6.5 }, // <-- Esta línea soluciona la altura
      headStyles: { fillColor: colorTerciario, textColor: negro, fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 9 }, 1: { cellWidth: 23 }, 2: { cellWidth: 4, halign: 'center' },
        3: { cellWidth: 9 }, 4: { cellWidth: 23 }, 5: { cellWidth: 4, halign: 'center' },
        6: { cellWidth: 9 }, 7: { cellWidth: 23 }, 8: { cellWidth: 4, halign: 'center' },
        9: { cellWidth: 9 }, 10: { cellWidth: 23 }, 11: { cellWidth: 4, halign: 'center' },
        12: { cellWidth: 9 }, 13: { cellWidth: 23 }, 14: { cellWidth: 4, halign: 'center' }
      },
      head: [[{ content: 'REGIONES', colSpan: 15, styles: { halign: 'left', fillColor: colorTerciario } }]],
      body: pdfFisicoRows as any,
     didDrawCell: function(data) {
        const raw = data.cell.raw as any;
        if (data.section === 'body' && raw && raw.textToRotate) {
          pdf.setTextColor(0); 
          pdf.setFontSize(5.5); 
          pdf.setFont('helvetica', 'bold');
          
          const str = String(raw.textToRotate);
          
          // EL SECRETO: Calculamos la altura real multiplicando 6.5mm por la cantidad de celdas combinadas
          const realHeight = 6.5 * (raw.rowSpan || 1);
          
          const textWidth = pdf.getTextWidth(str);
          
          // Calculamos el centro exacto de la celda grande
          const centroX = data.cell.x + (data.cell.width / 2);
          const centroY = data.cell.y + (realHeight / 2);
          
          // Si el texto es increíblemente largo, lo divide en 2 renglones como en Excel
          if (textWidth > realHeight - 2) {
             const lineas = pdf.splitTextToSize(str, realHeight - 2);
             
             // Primer renglón (derecha visualmente)
             const w1 = pdf.getTextWidth(lineas[0]);
             pdf.text(lineas[0], centroX + 1.5, centroY + (w1 / 2), { angle: 90 });
             
             // Segundo renglón (izquierda visualmente)
             if (lineas[1]) {
               const w2 = pdf.getTextWidth(lineas[1]);
               pdf.text(lineas[1], centroX - 0.5, centroY + (w2 / 2), { angle: 90 });
             }
          } else {
             // Texto en un solo renglón, anclado milimétricamente al centro
             const textX = centroX + 0.8; 
             const textY = centroY + (textWidth / 2);
             pdf.text(str, textX, textY, { angle: 90 });
          }
        }
      }
      });
      y = (pdf as any).lastAutoTable.finalY;

    if (ev.examenFisicoHallazgos && ev.examenFisicoHallazgos.length > 0) {
      const lineasFisico = ev.examenFisicoHallazgos
        .map((h: any) => `${h.codigo}. ${h.region || ''}, ${h.subregion || ''}: ${h.descripcion || '-'}`)
        .join('\n');
      textoLibre(`Observaciones:\n${lineasFisico}`, 6); 
      y += 1;
    } else { 
      textoLibre('Sin hallazgos patológicos al examen físico regional.', 5); 
      y += 1; 
    }
    // J. EXÁMENES COMPLEMENTARIOS
    if (ev.examenesComplementarios && ev.examenesComplementarios.length > 0) {
      checkPage(15); secHeader('J. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS');
      autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 }, head: [['EXAMEN', 'FECHA\naaaa / mm / dd', 'RESULTADO']], body: ev.examenesComplementarios.map((ex: any) => [ex.nombre, ex.fecha, ex.resultado]) });
      y = (pdf as any).lastAutoTable.finalY + 1;
    }

    // K. DIAGNÓSTICO
    checkPage(20); secHeader('K. DIAGNÓSTICO                    PRE= PRESUNTIVO          DEF= DEFINITIVO');
    if (ev.diagnosticos && ev.diagnosticos.length > 0) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'center' }, headStyles: { ...headStyles, fontSize: 6, halign: 'center' },
        head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']],
        body: ev.diagnosticos.map((dx: any, i: number) => [`${i + 1}`, { content: dx.descripcion, styles: { halign: 'left' } }, dx.cie || '-', dx.tipo === 'presuntivo' ? 'X' : '', dx.tipo === 'definitivo' ? 'X' : '']),
        columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } },
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    } else { textoLibre('PACIENTE SANO.', 5); y += 1; }

    // L. APTITUD MÉDICA
    checkPage(20); secHeader('L. APTITUD MÉDICA PARA EL TRABAJO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, halign: 'center', fontSize: 7 }, headStyles: { ...headStyles, halign: 'center', fontSize: 6.5 },
      head: [['APTO', 'APTO EN OBSERVACIÓN', 'APTO CON LIMITACIONES', 'NO APTO']],
      body: [[(!ev.aptitudMedica || ev.aptitudMedica === 'apto') ? 'X' : '', ev.aptitudMedica === 'aptoObservacion' ? 'X' : '', ev.aptitudMedica === 'aptoLimitaciones' ? 'X' : '', ev.aptitudMedica === 'noApto' ? 'X' : '']],
    });
    y = (pdf as any).lastAutoTable.finalY;
    autoTable(pdf, { startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'left' }, body: [[`Observación:  ${ev.aptitudObservacion || '-'}`], [`Limitación:   ${ev.aptitudLimitaciones || '-'}`]] });
    y = (pdf as any).lastAutoTable.finalY + 1;

    // M. RECOMENDACIONES
    secHeader('M. RECOMENDACIONES Y/O TRATAMIENTO');
    const recTexto = Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') + (ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : '') : (ev.recomendaciones || 'Ninguna particular al momento.');
    textoLibre(recTexto, 8); y += 2;

    // CERTIFICADO LEGAL
    checkPage(15);
    pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
    const certText = 'CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.';
    const certLines = pdf.splitTextToSize(certText, CW - 3); const certH = certLines.length * 3 + 3;
    pdf.rect(M, y, CW, certH, 'FD'); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.text(certLines, M + 1.5, y + 3); y += certH + 3;

    // N. DATOS DEL PROFESIONAL
    checkPage(25); secHeader('N. DATOS DEL PROFESIONAL                                                                             O. FIRMA DEL USUARIO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { ...baseStyles, fontSize: 6.5, halign: 'center' }, headStyles: { ...headStyles, fontSize: 6, halign: 'center' },
      head: [['FECHA\naaaa-mm-dd', 'HORA', 'NOMBRES Y APELLIDOS', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']],
      body: [[fmtF(ev.fecha), fmtHora(ev.fecha), (ev.medicoNombre || 'MÉDICO OCUPACIONAL').toUpperCase(), ev.medicoCedula || '-', '', '']],
      bodyStyles: { minCellHeight: 18, valign: 'bottom', halign: 'center' },
    });
    pdf.save(`SO-RE-38_${trabajador.primerApellido}_${trabajador.primerNombre}_${fmtF(ev.fecha)}.pdf`);
  };

  const exportarExcel = () => {
    const ev: any = evaluaciones[pestanaActiva];
    if (!ev || !trabajador) return;
    const diag = Array.isArray(ev.diagnosticos) ? ev.diagnosticos.map((d: any) => d.descripcion).join('; ') : '-';
    const recom = Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') : '-';
    const rows = [
      ['DATO', 'VALOR'],
      ['Nombres', `${trabajador.primerApellido} ${trabajador.segundoApellido || ''} ${trabajador.primerNombre} ${trabajador.segundoNombre || ''}`],
      ['Cédula', trabajador.cedula], ['Puesto', trabajador.puestoTrabajo],
      ['Fecha', fmtF(ev.fecha)], ['N° HC', ev.numeroHistoriaClinica || '-'],
      ['Aptitud', ev.aptitudMedica || 'Pendiente'], ['Diagnósticos', diag],
      ['PA', `${ev.signosVitales?.presionSistolica || '-'}/${ev.signosVitales?.presionDiastolica || '-'}`],
      ['IMC', String(ev.signosVitales?.imc || '-')], ['Recomendaciones', recom]
    ];
    const csv = "\ufeff" + rows.map(e => e.join(";")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Ficha_${trabajador.cedula}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (cargando) return <div className="min-h-screen p-8 text-center text-slate-500 font-bold">Cargando expediente...</div>;
  if (!trabajador) return <div className="min-h-screen p-8 text-center text-red-500 font-bold">Trabajador no encontrado</div>;
  const ev: any = evaluaciones[pestanaActiva] || null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* =========================================================
            CABECERA WEB
        ========================================================= */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{trabajador.primerApellido} {trabajador.segundoApellido || ''} {trabajador.primerNombre} {trabajador.segundoNombre || ''}</h1>
            <p className="text-slate-500 text-sm mt-1">CI: {trabajador.cedula} · Puesto: {trabajador.puestoTrabajo}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-sm">Volver</button>
            <button onClick={() => navigate(`/evaluar/${trabajador.id}`)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm text-sm">+ Nueva Evaluación</button>
          </div>
        </div>

        {evaluaciones.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">Este trabajador no tiene evaluaciones registradas.</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Pestañas de evaluaciones */}
            <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
              {evaluaciones.map((item, idx) => (
                <button key={item.id} onClick={() => setPestanaActiva(idx)} className={`px-6 py-4 font-semibold whitespace-nowrap transition-colors text-sm ${pestanaActiva === idx ? 'border-b-2 border-blue-600 text-blue-700 bg-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                  {fmtF(item.fecha)}
                </button>
              ))}
            </div>

            {ev && (
              <>
                <div className="p-4 bg-white border-b border-slate-100 flex justify-end gap-3">
                  <button onClick={exportarExcel} className="px-4 py-2 bg-[#107c41] text-white font-semibold rounded-lg hover:bg-[#0c5c30] flex items-center gap-2 text-sm shadow-sm">📊 Exportar Excel</button>
                  <button onClick={generarPDF} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm shadow-sm">📄 Exportar PDF (SO-RE-38)</button>
                </div>

                {/* =========================================================
                    VISTA WEB DE LA FICHA SO-RE-38
                ========================================================= */}
                <div className="p-6 md:p-8 space-y-5">
                  <div className="text-center mb-4 pb-3 border-b-2 border-slate-300">
                    <h2 className="text-xl font-bold uppercase text-slate-800">CEM AUSTROGAS</h2>
                    <p className="text-sm font-semibold text-slate-600">HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN PERIÓDICA (SO-RE-38)</p>
                    <div className="flex justify-center gap-8 mt-2 text-xs text-slate-500">
                      <span>N° Historia: {ev.numeroHistoriaClinica}</span><span>N° Archivo: {ev.numeroArchivo}</span><span>Fecha: {fmtFH(ev.fecha)}</span>
                    </div>
                  </div>

                  <Sec title="A. DATOS DEL ESTABLECIMIENTO Y USUARIO">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <KV k="Institución" v="CEM AUSTROGAS" /><KV k="RUC" v="190070301001" />
                      <KV k="Nombres" v={`${trabajador.primerNombre} ${trabajador.segundoNombre || ''}`} /><KV k="Apellidos" v={`${trabajador.primerApellido} ${trabajador.segundoApellido || ''}`} />
                      <KV k="Cédula" v={trabajador.cedula} /><KV k="Sexo" v={trabajador.sexo} /><KV k="Puesto" v={trabajador.puestoTrabajo} />
                    </div>
                  </Sec>

                  <Sec title="B. MOTIVO DE CONSULTA"><p className="text-xs uppercase">{ev.motivoConsulta || 'ACTUALIZACIÓN DE FICHA OCUPACIONAL'}</p></Sec>
                  
                  <Sec title="C. ANTECEDENTES PERSONALES Y LABORALES">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-bold text-slate-700 mb-1">Antecedentes Clínicos y Quirúrgicos:</p>
                        <p className="text-xs p-2 bg-slate-50 rounded border border-slate-100">{ev.antecedentesClinicosQuirurgicos || 'Sin registros'}</p>
                      </div>

                      {ev.habitosToxicos?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-700 mb-1">Hábitos Tóxicos:</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {ev.habitosToxicos.map((h: any, i: number) => (
                              <div key={i} className="bg-slate-50 p-2 rounded text-xs border border-slate-100">
                                <span className="font-semibold capitalize">{h.tipo}: </span>
                                {h.consume ? `Consume (${h.tiempoConsumo || '?'} meses, ${h.cantidad || '?'})` : h.exConsumidor ? `Ex consumidor (${h.tiempoAbstinencia || '?'} meses)` : 'No consume'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {ev.estiloVida && (
                        <div>
                          <p className="text-xs font-bold text-slate-700 mb-1">Estilo de Vida:</p>
                          <div className="bg-slate-50 p-2 rounded text-xs border border-slate-100 space-y-1">
                            <p><span className="font-semibold">Actividad física:</span> {ev.estiloVida.actividadFisica ? `Sí — ${ev.estiloVida.tipoActividad || ''} (${ev.estiloVida.tiempoCantidad || ''})` : 'No'}</p>
                            <p><span className="font-semibold">Medicación habitual:</span> {ev.estiloVida.medicacionHabitual ? `Sí — ${ev.estiloVida.medicacionHabitual} (${ev.estiloVida.medicacionCantidad || ''})` : 'No'}</p>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-slate-200 pt-3">
                        <p className="text-xs font-bold text-slate-700 mb-2">Incidentes, Accidentes y Enfermedad Profesional:</p>
                        <div className="space-y-2">
                          <div className="bg-slate-50 p-2 rounded text-xs border border-slate-100">
                            <span className="font-semibold block mb-1">Incidentes Reportados:</span>
                            {ev.incidentes || 'NINGUNO'}
                          </div>
                          
                          {ev.accidentesTrabajo?.descripcion && (
                            <div className="bg-red-50 p-2 rounded text-xs border border-red-100">
                              <span className="font-semibold text-red-800 block mb-1">Accidente de Trabajo:</span>
                              <p>{ev.accidentesTrabajo.descripcion}</p>
                              <div className="flex gap-4 mt-1 text-slate-600">
                                <span><span className="font-semibold">Calificado IESS:</span> {ev.accidentesTrabajo.calificado ? 'SÍ' : 'NO'}</span>
                                <span><span className="font-semibold">Obs:</span> {ev.accidentesTrabajo.observaciones || '-'}</span>
                              </div>
                            </div>
                          )}

                          {ev.enfermedadesProfesionales?.descripcion && (
                            <div className="bg-orange-50 p-2 rounded text-xs border border-orange-100">
                              <span className="font-semibold text-orange-800 block mb-1">Enfermedad Profesional:</span>
                              <p>{ev.enfermedadesProfesionales.descripcion}</p>
                              <div className="flex gap-4 mt-1 text-slate-600">
                                <span><span className="font-semibold">Calificada IESS:</span> {ev.enfermedadesProfesionales.calificada ? 'SÍ' : 'NO'}</span>
                                <span><span className="font-semibold">Obs:</span> {ev.enfermedadesProfesionales.observaciones || '-'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Sec>

                  <Sec title="D. ANTECEDENTES FAMILIARES">
                    <div className="overflow-x-auto mb-2">
                      <table className="w-full text-[10px] border-collapse border border-slate-300">
                        <tbody>
                          {[0, 1].map(r => (
                            <tr key={r}>
                              {[0,1,2,3].map(c => {
                                 const idx = r * 4 + c;
                                 const tipo = TIPOS_ANTECEDENTES_FAMILIARES[idx];
                                 const hasIt = ev.antecedentesFamiliares?.find((a:any) => a.tipo === tipo);
                                 return (
                                   <React.Fragment key={c}>
                                    <td className="border border-slate-300 p-1.5 bg-[#ccffff] text-slate-800">{idx+1}. {tipo}</td>
                                    <td className="border border-slate-300 p-1.5 text-center font-bold text-blue-700 bg-white w-6">{hasIt ? 'X' : ''}</td>
                                   </React.Fragment>
                                 )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {ev.antecedentesFamiliares?.length > 0 && (
                      <div className="text-xs space-y-1 border-t border-slate-200 pt-2 mt-2">
                        {ev.antecedentesFamiliares.map((af: any, i: number) => <p key={i}><span className="font-semibold">{af.tipo} ({af.parentesco}):</span> {af.descripcion}</p>)}
                      </div>
                    )}
                  </Sec>

                  {ev.factoresRiesgo && (
                    <Sec title="E. FACTORES DE RIESGO DEL PUESTO">
                      <div className="text-xs mb-2">
                        <span className="font-bold">Puesto:</span> {ev.factoresRiesgo.puestoArea || trabajador.puestoTrabajo}
                        {ev.factoresRiesgo.actividades && <> · <span className="font-bold">Actividades:</span> {ev.factoresRiesgo.actividades}</>}
                        {ev.factoresRiesgo.tiempoTrabajoMeses && <> · <span className="font-bold">Tiempo:</span> {ev.factoresRiesgo.tiempoTrabajoMeses} meses</>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(ev.factoresRiesgo.fisicos || []).map((r: string) => <span key={r} className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.mecanicos || []).map((r: string) => <span key={r} className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.quimicos || []).map((r: string) => <span key={r} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.biologicos || []).map((r: string) => <span key={r} className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.ergonomicos || []).map((r: string) => <span key={r} className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.psicosociales || []).map((r: string) => <span key={r} className="text-[10px] bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full">{r}</span>)}
                      </div>
                      {ev.factoresRiesgo.medidasPreventivas && <p className="text-xs italic text-slate-600">Medidas preventivas: {ev.factoresRiesgo.medidasPreventivas}</p>}
                    </Sec>
                  )}

                  <Sec title="F. ENFERMEDAD ACTUAL"><p className="text-xs uppercase">{ev.enfermedadActual || 'PACIENTE ASINTOMÁTICO AL MOMENTO DE LA VALORACIÓN.'}</p></Sec>

                  <Sec title="G. REVISIÓN DE ÓRGANOS Y SISTEMAS">
                    <div className="overflow-x-auto mb-2">
                      <table className="w-full text-[10px] border-collapse border border-slate-300">
                        <tbody>
                          {[0, 1].map(r => (
                            <tr key={r}>
                              {[0,1,2,3,4].map(c => {
                                 const idx = r * 5 + c;
                                 const sys = SISTEMAS[idx];
                                 const hasIt = ev.revisionSistemasSeleccionados?.includes(sys);
                                 return (
                                    <React.Fragment key={c}>
                                      <td className="border border-slate-300 p-1.5 bg-[#ccffff] text-slate-800">{idx+1}. {sys}</td>
                                      <td className="border border-slate-300 p-1.5 text-center font-bold text-blue-700 bg-white w-6">{hasIt ? 'X' : ''}</td>
                                    </React.Fragment>
                                 )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {ev.revisionSistemasSeleccionados?.length > 0 ? (
                      <p className="text-xs">{ev.revisionSistemasSeleccionados.map((s:string) => SISTEMAS.indexOf(s) + 1).sort((a:number,b:number)=>a-b).join(', ')}: {ev.revisionSistemasDescripcion}</p>
                    ) : <p className="text-xs text-green-700">Paciente no refiere síntomas adicionales al momento de la consulta</p>}
                  </Sec>

                  <Sec title="H. CONSTANTES VITALES Y ANTROPOMETRÍA">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                      {[
                        { l: 'P.A.', v: `${ev.signosVitales?.presionSistolica || ev.signosVitales?.presionArterial || '-'}/${ev.signosVitales?.presionDiastolica || '-'} mmHg` },
                        { l: 'Temp', v: `${ev.signosVitales?.temperatura || '-'} °C` },
                        { l: 'F.C.', v: `${ev.signosVitales?.frecuenciaCardiaca || '-'} lpm` },
                        { l: 'SAT O₂', v: `${ev.signosVitales?.saturacion || '-'} %` },
                        { l: 'F.R.', v: `${ev.signosVitales?.frecuenciaRespiratoria || '-'} rpm` },
                        { l: 'Peso', v: `${ev.signosVitales?.peso || '-'} Kg` },
                        { l: 'Talla', v: `${ev.signosVitales?.talla || '-'} cm` },
                        { l: 'IMC', v: `${ev.signosVitales?.imc || '-'}`, hl: true },
                        { l: 'Perím.', v: `${ev.signosVitales?.perimetroAbdominal || '-'} cm` },
                      ].map((s, i) => <div key={i} className={`p-2 rounded text-center ${(s as any).hl ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}><p className="text-slate-500 text-[10px]">{s.l}</p><p className={`font-bold ${(s as any).hl ? 'text-blue-800' : ''}`}>{s.v}</p></div>)}
                    </div>
                  </Sec>

                  <Sec title="I. EXAMEN FÍSICO REGIONAL">
                    <div className="overflow-x-auto mb-2">
                      <table className="w-full text-[9px] border-collapse border border-slate-300">
                        <thead>
                           <tr><th colSpan={15} className="bg-[#ccffff] border border-slate-300 p-1 text-left font-bold text-slate-800">REGIONES</th></tr>
                        </thead>
                        <tbody>
                          {FISICO_ROWS.map((row, i) => (
                             <tr key={i}>
                               {row.map((cell, j) => {
                                 // TEXTO VERTICAL (Controlado estrictamente con writing-mode)
                                 if(cell.type === 'reg') {
                                    return (
                                      <td key={j} rowSpan={cell.rs} className="bg-[#ccffff] border border-slate-300 align-middle text-center p-1 w-6">
                                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', display: 'inline-block' }} className="text-[10px] font-bold text-slate-800 tracking-widest whitespace-nowrap">
                                          {cell.txt}
                                        </div>
                                      </td>
                                    );
                                 }
                                 if(cell.type === 'sub') return <td key={j} className="border border-slate-300 p-1.5 bg-white text-slate-700">{cell.txt}</td>;
                                 if(cell.type === 'chk') {
                                   const checked = hasFisico(ev, cell.code as string);
                                   return <td key={j} className="border border-slate-300 p-1 text-center font-bold text-blue-700 bg-white w-6 min-w-[24px]">{checked ? 'X' : ''}</td>;
                                 }
                                 if(cell.type === 'empty') return <td key={j} rowSpan={cell.rs||1} colSpan={cell.cs||1} className="border-none bg-white p-0"></td>;
                                 if(cell.type === 'instr') return <td key={j} colSpan={cell.cs} className="border border-slate-300 p-1.5 text-center font-bold text-[8px] text-slate-500 bg-slate-50">{cell.txt}</td>;
                               })}
                             </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {ev.examenFisicoHallazgos?.length > 0 ? (
                      <div className="text-xs space-y-1 mt-3 border-t border-slate-200 pt-2">
                        {ev.examenFisicoHallazgos.map((h: any, i: number) => <p key={i}><span className="font-bold text-blue-700">{h.codigo}:</span> {h.descripcion}</p>)}
                      </div>
                    ) : <p className="text-xs text-green-700">Sin hallazgos patológicos al examen físico regional.</p>}
                  </Sec>

                  {ev.examenesComplementarios?.length > 0 && (
                    <Sec title="J. RESULTADOS DE EXÁMENES">
                      <table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="pb-1 font-semibold">Examen</th><th className="pb-1 font-semibold">Fecha</th><th className="pb-1 font-semibold">Resultado</th></tr></thead><tbody>
                        {ev.examenesComplementarios.map((ex: any, i: number) => <tr key={i} className="border-b border-slate-100"><td className="py-1">{ex.nombre}</td><td className="py-1">{ex.fecha}</td><td className="py-1">{ex.resultado}</td></tr>)}
                      </tbody></table>
                    </Sec>
                  )}

                  <Sec title="K. DIAGNÓSTICO">
                    {ev.diagnosticos?.length > 0 ? ev.diagnosticos.map((dx: any, i: number) => (
                      <p key={i} className="text-xs"><span className="font-semibold">{i + 1}.</span> {dx.descripcion} {dx.cie && <span className="text-slate-500 ml-1">(CIE: {dx.cie})</span>}
                        <span className={`ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${dx.tipo === 'definitivo' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{dx.tipo === 'definitivo' ? 'DEF' : 'PRE'}</span>
                      </p>
                    )) : <p className="text-xs text-slate-500">PACIENTE SANO.</p>}
                  </Sec>

                  <Sec title="L. APTITUD MÉDICA PARA EL TRABAJO">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${ev.aptitudMedica === 'apto' ? 'bg-green-100 text-green-800' : ev.aptitudMedica === 'aptoObservacion' ? 'bg-amber-100 text-amber-800' : ev.aptitudMedica === 'aptoLimitaciones' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                      {ev.aptitudMedica === 'apto' ? 'APTO' : ev.aptitudMedica === 'aptoObservacion' ? 'APTO EN OBSERVACIÓN' : ev.aptitudMedica === 'aptoLimitaciones' ? 'APTO CON LIMITACIONES' : 'NO APTO'}
                    </span>
                    {ev.aptitudObservacion && <p className="text-xs mt-1">Obs: {ev.aptitudObservacion}</p>}{ev.aptitudLimitaciones && <p className="text-xs mt-1">Limitación: {ev.aptitudLimitaciones}</p>}
                  </Sec>
                  <Sec title="M. RECOMENDACIONES Y/O TRATAMIENTO">
                    <p className="text-xs">{Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') : (ev.recomendaciones || 'Ninguna')}{ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : ''}</p>
                  </Sec>
                  <Sec title="N. DATOS DEL PROFESIONAL">
                    <div className="grid grid-cols-3 gap-4 text-xs text-center pt-2">
                      <div><span className="font-semibold block mb-1">MÉDICO EXAMINADOR</span> {ev.medicoNombre || '-'}</div><div><span className="font-semibold block mb-1">CÓDIGO MÉDICO</span> {ev.medicoCedula || '-'}</div><div><span className="font-semibold block mb-1">FECHA DE ATENCIÓN</span> {fmtFH(ev.fecha)}</div>
                    </div>
                  </Sec>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-800 bg-[#ccffcc] px-3 py-1.5 border border-slate-300 rounded-t">{title}</h3>
      <div className="border border-slate-300 border-t-0 rounded-b p-3 bg-white">{children}</div>
    </section>
  );
}
function KV({ k, v }: { k: string; v: string }) { return <div><span className="font-semibold block text-slate-500 text-[10px] uppercase">{k}</span> {v}</div>; }
