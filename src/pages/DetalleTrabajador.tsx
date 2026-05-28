import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trabajador, EvaluacionMedica } from '../types';

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

  // ============================================================
  //  GENERADOR PDF — Réplica fiel del formato SO-RE-38
  //  Usa jsPDF + autoTable: tablas con bordes negros, cabeceras
  //  grises, misma estructura que el documento Excel original
  // ============================================================
  const generarPDF = () => {
    const ev: any = evaluaciones[pestanaActiva];
    if (!ev || !trabajador) return;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const M = 7;
    const CW = W - M * 2;
    let y = 7;

    // Colores del formato original
    const gris: [number, number, number] = [210, 210, 210];
    const negro: [number, number, number] = [0, 0, 0];

    // Estilos base para autoTable — bordes negros como el Excel
    const baseStyles = {
      lineColor: negro, lineWidth: 0.25,
      fontSize: 7, cellPadding: 1.2, textColor: negro,
    };
    const headStyles = {
      fillColor: gris, textColor: negro, fontStyle: 'bold' as const,
      fontSize: 6.5, lineColor: negro, lineWidth: 0.25, cellPadding: 1.2,
    };

    // Helper: cabecera de sección (franja gris con borde negro)
    const secHeader = (texto: string) => {
      if (y > 275) { pdf.addPage(); y = 7; }
      pdf.setFillColor(...gris);
      pdf.setDrawColor(0);
      pdf.rect(M, y, CW, 5, 'FD');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(texto, M + 1.5, y + 3.5);
      y += 5;
    };

    // Helper: texto libre en recuadro con borde
    const textoLibre = (texto: string, minH = 8) => {
      pdf.setDrawColor(0); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(texto || '-', CW - 3);
      const h = Math.max(minH, lines.length * 3 + 2);
      pdf.rect(M, y, CW, h, 'S');
      pdf.text(lines, M + 1.5, y + 3);
      y += h;
    };

    // Helper: salto de página seguro
    const checkPage = (needed: number) => {
      if (y + needed > 285) { pdf.addPage(); y = 7; }
    };

    // =============== PÁGINA 1 ===============

    // ENCABEZADO CORPORATIVO (tabla 3x3 idéntica al Excel)
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, halign: 'center', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [
          { content: 'CEM AUSTROGAS', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } },
          { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN PERIÓDICA', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } },
          { content: 'Código:   SO-RE-38', styles: { fontSize: 7, halign: 'left' } }
        ],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [
          { content: 'MACROPROCESO: PLANIFICACIÓN, SEGURIDAD Y AMBIENTE', styles: { fontSize: 6, fontStyle: 'bold' } },
          { content: 'Página:    1 de 2', styles: { fontSize: 7, halign: 'left' } }
        ]
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // A. DATOS DEL ESTABLECIMIENTO
    secHeader('A. DATOS DEL ESTABLECIMIENTO - EMPRESA Y USUARIO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: baseStyles, headStyles: headStyles,
      head: [['INSTITUCIÓN DEL SISTEMA', 'RUC', 'CIU', 'ESTABLECIMIENTO DE SALUD', 'N° HISTORIA CLÍNICA', 'N° ARCHIVO']],
      body: [['CEM AUSTROGAS', '190070301001', '4661', 'MEDICINA OCUPACIONAL', ev.numeroHistoriaClinica || trabajador.cedula, ev.numeroArchivo || '-']],
    });
    y = (pdf as any).lastAutoTable.finalY;
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: baseStyles, headStyles: headStyles,
      head: [['PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'SEXO', 'PUESTO DE TRABAJO (CIUO)']],
      body: [[trabajador.primerApellido, trabajador.segundoApellido || '-', trabajador.primerNombre, trabajador.segundoNombre || '-', trabajador.sexo, trabajador.puestoTrabajo]],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // B. MOTIVO DE CONSULTA
    secHeader('B. MOTIVO DE CONSULTA');
    textoLibre((ev.motivoConsulta || 'ACTUALIZACIÓN DE FICHA OCUPACIONAL').toUpperCase(), 6);
    y += 1;

    // C. ANTECEDENTES PERSONALES
    secHeader('C. ANTECEDENTES PERSONALES');

    // Clínicos y quirúrgicos
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'S');
    pdf.text('ANTECEDENTES CLÍNICOS Y QUIRÚRGICOS', M + 1.5, y + 3); y += 4;
    textoLibre(ev.antecedentesClinicosQuirurgicos || 'Sin antecedentes relevantes reportados.', 5);

    // Hábitos tóxicos
    if (ev.habitosToxicos && ev.habitosToxicos.length > 0) {
      checkPage(20);
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['CONSUMOS NOCIVOS', 'SI', 'NO', 'TIEMPO CONSUMO\n(meses)', 'CANTIDAD', 'EX\nCONSUMIDOR', 'TIEMPO ABSTINENCIA\n(meses)']],
        body: ev.habitosToxicos.map((h: any) => [
          h.tipo.toUpperCase(), h.consume ? 'X' : '', h.consume ? '' : 'X',
          h.tiempoConsumo || '-', h.cantidad || '-', h.exConsumidor ? 'X' : '', h.tiempoAbstinencia || '-'
        ]),
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 5: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }

    // Estilo de vida
    if (ev.estiloVida) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['ESTILO DE VIDA', 'SI', 'NO', '¿CUÁL?', 'TIEMPO / CANTIDAD']],
        body: [
          ['ACTIVIDAD FÍSICA', ev.estiloVida.actividadFisica ? 'X' : '', ev.estiloVida.actividadFisica ? '' : 'X', ev.estiloVida.tipoActividad || '-', ev.estiloVida.tiempoCantidad || '-'],
          ['MEDICACIÓN HABITUAL', ev.estiloVida.medicacionHabitual ? 'X' : '', ev.estiloVida.medicacionHabitual ? '' : 'X', ev.estiloVida.medicacionHabitual || '-', ev.estiloVida.medicacionCantidad || '-']
        ],
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      });
      y = (pdf as any).lastAutoTable.finalY;
    }

    // Incidentes
    pdf.setDrawColor(0); pdf.rect(M, y, CW, 4, 'S');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text('INCIDENTES', M + 1.5, y + 3);
    pdf.setFont('helvetica', 'normal');
    pdf.text(ev.incidentes || 'NINGUNO', M + 25, y + 3);
    y += 5;

    // Accidentes de trabajo
    if (ev.accidentesTrabajo?.descripcion) {
      checkPage(15);
      secHeader('ACCIDENTES DE TRABAJO (DESCRIPCIÓN)');
      textoLibre(ev.accidentesTrabajo.descripcion, 4);
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6 },
        body: [[
          `Calificado IESS: ${ev.accidentesTrabajo.calificado ? 'SÍ' : 'NO'}`,
          `Especificar: ${ev.accidentesTrabajo.especificacion || '-'}`,
          `Obs: ${ev.accidentesTrabajo.observaciones || '-'}`
        ]],
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    }

    // Enfermedades profesionales
    if (ev.enfermedadesProfesionales?.descripcion) {
      checkPage(10);
      secHeader('ENFERMEDADES PROFESIONALES');
      textoLibre(ev.enfermedadesProfesionales.descripcion, 4);
      y += 1;
    }

    // D. ANTECEDENTES FAMILIARES
    checkPage(15);
    secHeader('D. ANTECEDENTES FAMILIARES (DETALLAR EL PARENTESCO)');
    if (ev.antecedentesFamiliares && ev.antecedentesFamiliares.length > 0) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['N°', 'TIPO', 'PARENTESCO', 'DESCRIPCIÓN']],
        body: ev.antecedentesFamiliares.map((af: any, i: number) => [`${i + 1}`, af.tipo, af.parentesco || '-', af.descripcion || '-']),
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    } else {
      textoLibre('No se refieren antecedentes familiares de importancia.', 5);
      y += 1;
    }

    // E. FACTORES DE RIESGO DEL PUESTO
    if (ev.factoresRiesgo) {
      checkPage(25);
      secHeader('E. FACTORES DE RIESGOS DEL PUESTO DE TRABAJO');
      const fr = ev.factoresRiesgo;

      // Puesto / Actividades / Tiempo
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['PUESTO DE TRABAJO / ÁREA', 'ACTIVIDADES', 'TIEMPO DE TRABAJO (MESES)']],
        body: [[fr.puestoArea || trabajador.puestoTrabajo, fr.actividades || '-', fr.tiempoTrabajoMeses || '-']],
      });
      y = (pdf as any).lastAutoTable.finalY;

      // Tabla de riesgos por categoría
      const categorias = [
        { nombre: 'FÍSICO', items: fr.fisicos || [] },
        { nombre: 'MECÁNICO', items: fr.mecanicos || [] },
        { nombre: 'QUÍMICO', items: fr.quimicos || [] },
        { nombre: 'BIOLÓGICO', items: fr.biologicos || [] },
        { nombre: 'ERGONÓMICO', items: fr.ergonomicos || [] },
        { nombre: 'PSICOSOCIAL', items: fr.psicosociales || [] },
      ].filter(c => c.items.length > 0);

      if (categorias.length > 0) {
        autoTable(pdf, {
          startY: y, margin: { left: M, right: M }, theme: 'grid',
          styles: { ...baseStyles, fontSize: 6 }, headStyles: { ...headStyles, fontSize: 5.5 },
          head: [['CATEGORÍA', 'FACTORES DE RIESGO IDENTIFICADOS']],
          body: categorias.map(c => [c.nombre, c.items.join(', ')]),
          columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } },
        });
        y = (pdf as any).lastAutoTable.finalY;
      }

      // Medidas preventivas
      if (fr.medidasPreventivas) {
        autoTable(pdf, {
          startY: y, margin: { left: M, right: M }, theme: 'grid',
          styles: { ...baseStyles, fontSize: 6 },
          head: [['MEDIDAS PREVENTIVAS']],
          headStyles: { ...headStyles, fontSize: 6 },
          body: [[fr.medidasPreventivas]],
        });
        y = (pdf as any).lastAutoTable.finalY;
      }
      y += 2;
    }

    // =============== PÁGINA 2 ===============
    pdf.addPage(); y = 7;

    // Encabezado página 2
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, halign: 'center', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 33 } },
      body: [
        [
          { content: 'CEM AUSTROGAS', rowSpan: 3, styles: { fontStyle: 'bold', fontSize: 11, valign: 'middle' } },
          { content: 'HISTORIA CLÍNICA OCUPACIONAL:\nEVALUACIÓN PERIÓDICA', rowSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, valign: 'middle' } },
          { content: 'Código:   SO-RE-38', styles: { fontSize: 7, halign: 'left' } }
        ],
        [{ content: 'Revisión:  1', styles: { fontSize: 7, halign: 'left' } }],
        [
          { content: 'PROCESO: GESTIÓN DE SEGURIDAD INDUSTRIAL Y MEDICINA OCUPACIONAL', styles: { fontSize: 6, fontStyle: 'bold' } },
          { content: 'Página:    2 de 2', styles: { fontSize: 7, halign: 'left' } }
        ]
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // F. ENFERMEDAD ACTUAL
    secHeader('F. ENFERMEDAD ACTUAL');
    textoLibre(ev.enfermedadActual || 'PACIENTE ASINTOMÁTICO AL MOMENTO DE LA VALORACIÓN.', 8);
    y += 1;

    // G. REVISIÓN DE ÓRGANOS Y SISTEMAS
    secHeader('G. REVISIÓN DE ÓRGANOS Y SISTEMAS');
    if (ev.revisionSistemasSeleccionados && ev.revisionSistemasSeleccionados.length > 0) {
      textoLibre(`Sistemas afectados: ${ev.revisionSistemasSeleccionados.join(', ')}\nDescripción: ${ev.revisionSistemasDescripcion || '-'}`, 8);
    } else {
      textoLibre('Paciente no refiere síntomas adicionales o relevantes al momento de la consulta.', 5);
    }
    y += 1;

    // H. CONSTANTES VITALES
    secHeader('H. CONSTANTES VITALES Y ANTROPOMETRÍA');
    const sv = ev.signosVitales || {};
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, halign: 'center', fontSize: 7 },
      headStyles: { ...headStyles, fontSize: 5.5, halign: 'center' },
      head: [['PRESIÓN\nARTERIAL\n(mmHg)', 'TEMP.\n(°C)', 'FREC.\nCARDÍACA\n(Lat/min)', 'SAT. DE\nOXÍGENO\n(O₂%)', 'FREC.\nRESP.\n(fr/min)', 'PESO\n(Kg)', 'TALLA\n(cm)', 'IMC\n(Kg/m²)', 'PERÍM.\nABD.\n(cm)']],
      body: [[
        `${ev.signosVitales?.presionSistolica || '-'}/${ev.signosVitales?.presionDiastolica || '-'}`,
        ev.signosVitales?.temperatura || '-', ev.signosVitales?.frecuenciaCardiaca || '-', ev.signosVitales?.saturacion || '-',
        ev.signosVitales?.frecuenciaRespiratoria || '-', ev.signosVitales?.peso || '-', ev.signosVitales?.signosVitales?.talla || '-',
        ev.signosVitales?.imc || '-', ev.signosVitales?.perimetroAbdominal || '-'
      ]],
    });
    y = (pdf as any).lastAutoTable.finalY + 2;

    // I. EXAMEN FÍSICO REGIONAL
    secHeader('I. EXAMEN FÍSICO REGIONAL');
    if (ev.examenFisicoHallazgos && ev.examenFisicoHallazgos.length > 0) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['N°', 'REGIÓN', 'SUBREGIÓN', 'OBSERVACIÓN']],
        body: ev.examenFisicoHallazgos.map((h: any) => [h.codigo, h.region, h.subregion, h.descripcion || '-']),
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    } else {
      textoLibre('Sin hallazgos patológicos al examen físico regional.', 5);
      y += 1;
    }

    // J. EXÁMENES COMPLEMENTARIOS
    if (ev.examenesComplementarios && ev.examenesComplementarios.length > 0) {
      checkPage(15);
      secHeader('J. RESULTADOS DE EXÁMENES GENERALES Y ESPECÍFICOS');
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6.5 }, headStyles: { ...headStyles, fontSize: 6 },
        head: [['EXAMEN', 'FECHA\naaaa / mm / dd', 'RESULTADO']],
        body: ev.examenesComplementarios.map((ex: any) => [ex.nombre, ex.fecha, ex.resultado]),
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    }

    // K. DIAGNÓSTICO
    checkPage(20);
    secHeader('K. DIAGNÓSTICO                    PRE= PRESUNTIVO          DEF= DEFINITIVO');
    if (ev.diagnosticos && ev.diagnosticos.length > 0) {
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { ...baseStyles, fontSize: 6.5, halign: 'center' },
        headStyles: { ...headStyles, fontSize: 6, halign: 'center' },
        head: [['N°', 'DESCRIPCIÓN', 'CIE', 'PRE', 'DEF']],
        body: ev.diagnosticos.map((dx: any, i: number) => [
          `${i + 1}`,
          { content: dx.descripcion, styles: { halign: 'left' } },
          dx.cie || '-',
          dx.tipo === 'presuntivo' ? 'X' : '',
          dx.tipo === 'definitivo' ? 'X' : ''
        ]),
        columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } },
      });
      y = (pdf as any).lastAutoTable.finalY + 1;
    } else {
      textoLibre('PACIENTE SANO.', 5);
      y += 1;
    }

    // L. APTITUD MÉDICA
    checkPage(20);
    secHeader('L. APTITUD MÉDICA PARA EL TRABAJO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, halign: 'center', fontSize: 7 },
      headStyles: { ...headStyles, halign: 'center', fontSize: 6.5 },
      head: [['APTO', 'APTO EN OBSERVACIÓN', 'APTO CON LIMITACIONES', 'NO APTO']],
      body: [[
        (!ev.aptitudMedica || ev.aptitudMedica === 'apto') ? 'X' : '',
        ev.aptitudMedica === 'aptoObservacion' ? 'X' : '',
        ev.aptitudMedica === 'aptoLimitaciones' ? 'X' : '',
        ev.aptitudMedica === 'noApto' ? 'X' : ''
      ]],
    });
    y = (pdf as any).lastAutoTable.finalY;

    // Observación y Limitación
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, fontSize: 6.5, halign: 'left' },
      body: [
        [`Observación:  ${ev.aptitudObservacion || '-'}`],
        [`Limitación:   ${ev.aptitudLimitaciones || '-'}`]
      ],
    });
    y = (pdf as any).lastAutoTable.finalY + 1;

    // M. RECOMENDACIONES
    secHeader('M. RECOMENDACIONES Y/O TRATAMIENTO');
    const recTexto = Array.isArray(ev.recomendaciones)
      ? ev.recomendaciones.join('; ') + (ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : '')
      : (ev.recomendaciones || 'Ninguna particular al momento.');
    textoLibre(recTexto, 8);
    y += 2;

    // CERTIFICADO LEGAL
    checkPage(15);
    pdf.setFillColor(248, 248, 248); pdf.setDrawColor(0);
    const certText = 'CERTIFICO QUE LO ANTERIORMENTE EXPRESADO EN RELACIÓN A MI ESTADO DE SALUD ES VERDAD. SE ME HA INFORMADO LAS MEDIDAS PREVENTIVAS A TOMAR PARA DISMINUIR O MITIGAR LOS RIESGOS RELACIONADOS CON MI ACTIVIDAD LABORAL.';
    const certLines = pdf.splitTextToSize(certText, CW - 3);
    const certH = certLines.length * 3 + 3;
    pdf.rect(M, y, CW, certH, 'FD');
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold');
    pdf.text(certLines, M + 1.5, y + 3);
    y += certH + 3;

    // N. DATOS DEL PROFESIONAL + O. FIRMA DEL USUARIO
    checkPage(25);
    secHeader('N. DATOS DEL PROFESIONAL                                                                             O. FIRMA DEL USUARIO');
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { ...baseStyles, fontSize: 6.5 },
      headStyles: { ...headStyles, fontSize: 6, halign: 'center' },
      head: [['FECHA\naaaa-mm-dd', 'HORA', 'NOMBRES Y APELLIDOS', 'CÓDIGO', 'FIRMA Y SELLO', 'FIRMA DEL USUARIO']],
      body: [[
        fmtF(ev.fecha), fmtHora(ev.fecha),
        (ev.medicoNombre || 'MÉDICO OCUPACIONAL').toUpperCase(),
        ev.medicoCedula || '-', '', ''
      ]],
      bodyStyles: { minCellHeight: 18, valign: 'bottom' },
    });

    // Guardar archivo
    const nombre = `SO-RE-38_${trabajador.primerApellido}_${trabajador.primerNombre}_${fmtF(ev.fecha)}`.replace(/[\s\/]/g, '_');
    pdf.save(`${nombre}.pdf`);
  };

  // ============ EXPORTAR CSV ============
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

  // ============ RENDER ============

  if (cargando) return <div className="min-h-screen p-8 text-center text-slate-500 font-bold">Cargando expediente...</div>;
  if (!trabajador) return <div className="min-h-screen p-8 text-center text-red-500 font-bold">Trabajador no encontrado</div>;

  const ev: any = evaluaciones[pestanaActiva] || null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabecera */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {trabajador.primerApellido} {trabajador.segundoApellido || ''} {trabajador.primerNombre} {trabajador.segundoNombre || ''}
            </h1>
            <p className="text-slate-500 text-sm mt-1">CI: {trabajador.cedula} · Puesto: {trabajador.puestoTrabajo}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-sm">Volver</button>
            <button onClick={() => navigate(`/evaluar/${trabajador.id}`)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm text-sm">+ Nueva Evaluación</button>
          </div>
        </div>

        {evaluaciones.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
            Este trabajador no tiene evaluaciones registradas.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Pestañas de evaluaciones */}
            <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
              {evaluaciones.map((item, idx) => (
                <button key={item.id} onClick={() => setPestanaActiva(idx)}
                  className={`px-6 py-4 font-semibold whitespace-nowrap transition-colors text-sm ${
                    pestanaActiva === idx ? 'border-b-2 border-blue-600 text-blue-700 bg-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}>
                  {fmtF(item.fecha)}
                </button>
              ))}
            </div>

            {ev && (
              <>
                {/* Botones de exportación */}
                <div className="p-4 bg-white border-b border-slate-100 flex justify-end gap-3">
                  <button onClick={exportarExcel} className="px-4 py-2 bg-[#107c41] text-white font-semibold rounded-lg hover:bg-[#0c5c30] flex items-center gap-2 text-sm shadow-sm">
                    📊 Exportar Excel
                  </button>
                  <button onClick={generarPDF} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm shadow-sm">
                    📄 Exportar PDF (SO-RE-38)
                  </button>
                </div>

                {/* Vista en pantalla */}
                <div className="p-6 md:p-8 space-y-5">

                  <div className="text-center mb-4 pb-3 border-b-2 border-slate-300">
                    <h2 className="text-xl font-bold uppercase text-slate-800">CEM AUSTROGAS</h2>
                    <p className="text-sm font-semibold text-slate-600">HISTORIA CLÍNICA OCUPACIONAL: EVALUACIÓN PERIÓDICA (SO-RE-38)</p>
                    <div className="flex justify-center gap-8 mt-2 text-xs text-slate-500">
                      <span>N° Historia: {ev.numeroHistoriaClinica}</span>
                      <span>N° Archivo: {ev.numeroArchivo}</span>
                      <span>Fecha: {fmtFH(ev.fecha)}</span>
                    </div>
                  </div>

                  <Sec title="A. DATOS DEL ESTABLECIMIENTO Y USUARIO">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <KV k="Institución" v="CEM AUSTROGAS" /><KV k="RUC" v="190070301001" />
                      <KV k="Nombres" v={`${trabajador.primerNombre} ${trabajador.segundoNombre || ''}`} />
                      <KV k="Apellidos" v={`${trabajador.primerApellido} ${trabajador.segundoApellido || ''}`} />
                      <KV k="Cédula" v={trabajador.cedula} /><KV k="Sexo" v={trabajador.sexo} /><KV k="Puesto" v={trabajador.puestoTrabajo} />
                    </div>
                  </Sec>

                  <Sec title="B. MOTIVO DE CONSULTA"><p className="text-xs">{ev.motivoConsulta || 'No especificado'}</p></Sec>

                  <Sec title="C. ANTECEDENTES PERSONALES">
                    <p className="text-xs mb-2"><span className="font-bold">Clínicos y Quirúrgicos:</span> {ev.antecedentesClinicosQuirurgicos || 'Sin registros'}</p>
                    {ev.habitosToxicos?.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {ev.habitosToxicos.map((h: any, i: number) => (
                          <div key={i} className="bg-slate-50 p-2 rounded text-xs">
                            <span className="font-semibold capitalize">{h.tipo}: </span>
                            {h.consume ? `Consume (${h.tiempoConsumo || '?'}m)` : h.exConsumidor ? 'Ex consumidor' : 'No consume'}
                          </div>
                        ))}
                      </div>
                    )}
                  </Sec>

                  {ev.antecedentesFamiliares?.length > 0 && (
                    <Sec title="D. ANTECEDENTES FAMILIARES">
                      {ev.antecedentesFamiliares.map((af: any, i: number) => (
                        <p key={i} className="text-xs"><span className="font-semibold">{af.tipo}:</span> {af.parentesco} — {af.descripcion}</p>
                      ))}
                    </Sec>
                  )}

                  {ev.factoresRiesgo && (
                    <Sec title="E. FACTORES DE RIESGO DEL PUESTO">
                      <div className="text-xs mb-2">
                        <span className="font-bold">Puesto:</span> {ev.factoresRiesgo.puestoArea || trabajador.puestoTrabajo}
                        {ev.factoresRiesgo.actividades && <> · <span className="font-bold">Actividades:</span> {ev.factoresRiesgo.actividades}</>}
                        {ev.factoresRiesgo.tiempoTrabajoMeses && <> · <span className="font-bold">Tiempo:</span> {ev.factoresRiesgo.tiempoTrabajoMeses} meses</>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(ev.factoresRiesgo.fisicos || []).map((r: string) => <span key={r} className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.mecanicos || []).map((r: string) => <span key={r} className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.quimicos || []).map((r: string) => <span key={r} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.biologicos || []).map((r: string) => <span key={r} className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.ergonomicos || []).map((r: string) => <span key={r} className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{r}</span>)}
                        {(ev.factoresRiesgo.psicosociales || []).map((r: string) => <span key={r} className="text-[10px] bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full">{r}</span>)}
                      </div>
                      {ev.factoresRiesgo.medidasPreventivas && <p className="text-xs mt-2 italic text-slate-600">Medidas preventivas: {ev.factoresRiesgo.medidasPreventivas}</p>}
                    </Sec>
                  )}

                  <Sec title="F. ENFERMEDAD ACTUAL"><p className="text-xs">{ev.enfermedadActual || 'Sin novedad'}</p></Sec>

                  <Sec title="G. REVISIÓN DE ÓRGANOS Y SISTEMAS">
                    {ev.revisionSistemasSeleccionados?.length > 0 ? (
                      <><p className="text-xs font-semibold mb-1">Afectados: {ev.revisionSistemasSeleccionados.join(', ')}</p><p className="text-xs">{ev.revisionSistemasDescripcion}</p></>
                    ) : <p className="text-xs text-green-700">Paciente no refiere síntomas adicionales al momento de la consulta</p>}
                  </Sec>

                  <Sec title="H. CONSTANTES VITALES Y ANTROPOMETRÍA">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                      {[
                        { l: 'P.A.', v: `${ev.signosVitales?.presionSistolica || '-'}/${sv?.presionDiastolica || '-'} mmHg` },
                        { l: 'Temp', v: `${ev.signosVitales?.temperatura || '-'} °C` },
                        { l: 'F.C.', v: `${ev.signosVitales?.frecuenciaCardiaca || '-'} lpm` },
                        { l: 'SAT O₂', v: `${ev.signosVitales?.saturacion || '-'} %` },
                        { l: 'F.R.', v: `${ev.signosVitales?.frecuenciaRespiratoria || '-'} rpm` },
                        { l: 'Peso', v: `${ev.signosVitales?.peso || '-'} Kg` },
                        { l: 'Talla', v: `${ev.signosVitales?.talla || '-'} cm` },
                        { l: 'IMC', v: `${ev.signosVitales?.imc || '-'}`, hl: true },
                        { l: 'Perím.', v: `${ev.signosVitales?.perimetroAbdominal || '-'} cm` },
                      ].map((s, i) => (
                        <div key={i} className={`p-2 rounded text-center ${(s as any).hl ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
                          <p className="text-slate-500 text-[10px]">{s.l}</p>
                          <p className={`font-bold ${(s as any).hl ? 'text-blue-800' : ''}`}>{s.v}</p>
                        </div>
                      ))}
                    </div>
                  </Sec>

                  <Sec title="I. EXAMEN FÍSICO REGIONAL">
                    {ev.examenFisicoHallazgos?.length > 0 ? ev.examenFisicoHallazgos.map((h: any, i: number) => (
                      <p key={i} className="text-xs"><span className="font-bold text-blue-700">{h.codigo}:</span> {h.region} — {h.subregion}: {h.descripcion}</p>
                    )) : <p className="text-xs text-green-700">Sin signos relevantes al momento de la consulta</p>}
                  </Sec>

                  {ev.examenesComplementarios?.length > 0 && (
                    <Sec title="J. RESULTADOS DE EXÁMENES">
                      <table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="pb-1 font-semibold">Examen</th><th className="pb-1 font-semibold">Fecha</th><th className="pb-1 font-semibold">Resultado</th></tr></thead><tbody>
                        {ev.examenesComplementarios.map((ex: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100"><td className="py-1">{ex.nombre}</td><td className="py-1">{ex.fecha}</td><td className="py-1">{ex.resultado}</td></tr>
                        ))}
                      </tbody></table>
                    </Sec>
                  )}

                  <Sec title="K. DIAGNÓSTICO">
                    {ev.diagnosticos?.length > 0 ? ev.diagnosticos.map((dx: any, i: number) => (
                      <p key={i} className="text-xs">
                        <span className="font-semibold">{i + 1}.</span> {dx.descripcion}
                        {dx.cie && <span className="text-slate-500 ml-1">(CIE: {dx.cie})</span>}
                        <span className={`ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${dx.tipo === 'definitivo' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {dx.tipo === 'definitivo' ? 'DEF' : 'PRE'}
                        </span>
                      </p>
                    )) : <p className="text-xs text-slate-500">Paciente sano</p>}
                  </Sec>

                  <Sec title="L. APTITUD MÉDICA PARA EL TRABAJO">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                      ev.aptitudMedica === 'apto' ? 'bg-green-100 text-green-800' :
                      ev.aptitudMedica === 'aptoObservacion' ? 'bg-amber-100 text-amber-800' :
                      ev.aptitudMedica === 'aptoLimitaciones' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {ev.aptitudMedica === 'apto' ? 'APTO' : ev.aptitudMedica === 'aptoObservacion' ? 'APTO EN OBSERVACIÓN' : ev.aptitudMedica === 'aptoLimitaciones' ? 'APTO CON LIMITACIONES' : 'NO APTO'}
                    </span>
                    {ev.aptitudObservacion && <p className="text-xs mt-1">Obs: {ev.aptitudObservacion}</p>}
                    {ev.aptitudLimitaciones && <p className="text-xs mt-1">Limitación: {ev.aptitudLimitaciones}</p>}
                  </Sec>

                  <Sec title="M. RECOMENDACIONES Y/O TRATAMIENTO">
                    <p className="text-xs">{Array.isArray(ev.recomendaciones) ? ev.recomendaciones.join('; ') : (ev.recomendaciones || 'Ninguna')}{ev.recomendacionesOtras ? `; ${ev.recomendacionesOtras}` : ''}</p>
                  </Sec>

                  <Sec title="N. DATOS DEL PROFESIONAL">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div><span className="font-semibold">Nombre:</span> {ev.medicoNombre || '-'}</div>
                      <div><span className="font-semibold">Código:</span> {ev.medicoCedula || '-'}</div>
                      <div><span className="font-semibold">Fecha:</span> {fmtFH(ev.fecha)}</div>
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

// Componentes auxiliares
function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold text-white bg-slate-700 px-3 py-1.5 rounded-t">{title}</h3>
      <div className="border border-slate-300 border-t-0 rounded-b p-3">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return <div><span className="font-semibold">{k}:</span> {v}</div>;
}
