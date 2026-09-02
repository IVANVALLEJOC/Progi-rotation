(function() {
    'use strict';

    function extraerDatosPieza(fila) {
        let inputTipoPieza = document.querySelector('#part_type');
        let tipoPieza = inputTipoPieza ? (inputTipoPieza.value || inputTipoPieza.getAttribute('value') || '') : '';

        if (!fila || !fila.parentElement) return null;
        const padre = fila.parentElement;

        let inputAnio = fila.querySelector('#year') || padre.querySelector('#year') || document.querySelector('#year');
        let anioPieza = inputAnio ? parseInt(inputAnio.value || inputAnio.getAttribute('value'), 10) : null;

        if (!anioPieza || isNaN(anioPieza)) {
            let vehiculoEl = fila.querySelector('.vehicle_info') || padre.querySelector('.vehicle_info');
            let matchAnio = vehiculoEl ? vehiculoEl.innerText.match(/\b(19|20)\d{2}\b/) : null;
            anioPieza = matchAnio ? parseInt(matchAnio[0], 10) : null;
        }

        let celdas = fila.querySelectorAll('td');
        let numPieza = celdas[0]?.innerText.trim() || '';

        let stock = padre.getAttribute('data-stock-calculado');

        if (stock === null) {
            stock = 0;
            let filasStock = padre.querySelectorAll('tr.stock-row');

            filasStock.forEach(r => {
                let btnQual = r.querySelector('.quality-code-help');
                let calidadFila = btnQual ? btnQual.innerText.trim().toUpperCase() : '';

                if (calidadFila === 'A' || calidadFila === 'B') {
                    let celdasFila = r.querySelectorAll('td');
                    let cantidadFila = celdasFila[1] ? (parseInt(celdasFila[1].innerText.trim()) || 1) : 1;
                    stock += cantidadFila;
                }
            });

            padre.setAttribute('data-stock-calculado', stock);
        } else {
            stock = parseInt(stock, 10);
        }

        let vdEl = padre.querySelector('.sales_demands');
        let vd = vdEl ? parseFloat(vdEl.innerText.match(/\d+(\.\d+)?/)?.[0]) : 0;

        let btnCalidad = fila.querySelector('.quality-code-help');
        let calidad = btnCalidad ? btnCalidad.innerText.trim().toUpperCase() : 'A';

        let edad = parseInt(celdas[7]?.innerText.trim()) || 0;
        let isBolted = fila.classList.contains('bolted');
        let textoFila = fila.innerText.toUpperCase();

        let matchesD = textoFila.match(/\d+D\d+/g) || [];
        let matchesP = textoFila.match(/\d+P(\.\d+)?/g) || [];

        return {
            tipoPieza,
            numPieza,
            stock,
            vd,
            calidad,
            edad,
            anioPieza,
            isBolted,
            matchesD,
            matchesP,
            celdas
        };
    }

    function calcularScoreYDescuento(datos) {
        let score = 0;
        let desglose = [];
        let anioActual = new Date().getFullYear();
        let esVehiculoReciente = false;

        let tipoPiezaStr = (datos.tipoPieza || '').trim();
        let esMotorOTransmision = /^(100|200)\b/.test(tipoPiezaStr);

        if (datos.anioPieza && !isNaN(datos.anioPieza)) {
            let edadAnios = anioActual - datos.anioPieza;
            if (edadAnios <= 6) {
                esVehiculoReciente = true;
            }
        }

        if (esVehiculoReciente && datos.calidad !== 'C') {
            desglose.push(`Auto reciente (${datos.anioPieza}): Sin descuento por buena calidad`);
            return { score: 0, config: null, desglose };
        }

        if (datos.calidad === 'P') {
            desglose.push("Calidad 'P': Excluida (Score: 0)");
            return { score: 0, config: null, desglose };
        }

        if (datos.calidad === 'C') {
            if (esVehiculoReciente) {
                score += 12;
                desglose.push(`Calidad C en auto reciente (${datos.anioPieza}): +12 pts`);
            } else if (esMotorOTransmision) {
                score += 50;
                desglose.push("Motor/Transmisión (100/200) antiguo en Calidad C: +50 pts base");
            } else {
                score += 30;
                desglose.push("Calidad C en auto antiguo: +30 pts");
            }
        } else if (datos.calidad === 'B') {
            score += 2;
            desglose.push("Calidad B: +2 pts");
        } else {
            desglose.push(`Calidad ${datos.calidad}: 0 pts`);
        }

        if (datos.vd < 10) { score += 5; desglose.push(`VD (${datos.vd}) < 10: +5 pts`); }
        else if (datos.vd < 30) { score += 2; desglose.push(`VD (${datos.vd}) < 30: +2 pts`); }

        if (datos.edad > 600) { score += 10; desglose.push(`Edad (${datos.edad}) > 600: +10 pts`); }
        else if (datos.edad > 300) { score += 4; desglose.push(`Edad (${datos.edad}) > 300: +4 pts`); }
        else if (datos.edad > 120) { score += 2; desglose.push(`Edad (${datos.edad}) > 120: +2 pts`); }

        if (datos.stock > 50) { score += 8; desglose.push(`Stock (${datos.stock}) > 50: +8 pts`); }
        else if (datos.stock > 20) { score += 4; desglose.push(`Stock (${datos.stock}) 21-50: +4 pts`); }
        else if (datos.stock > 10) { score += 2; desglose.push(`Stock (${datos.stock}) 11-20: +2 pts`); }
        else { desglose.push(`Stock (${datos.stock}) <= 10: 0 pts (Stock protegido)`); }

        let ptsD = (datos.matchesD || []).length * 2;
        let ptsP = (datos.matchesP || []).length * 1;
        if (ptsD > 0) { score += ptsD; desglose.push(`Códigos D: +${ptsD} pts`); }
        if (ptsP > 0) { score += ptsP; desglose.push(`Códigos P: +${ptsP} pts`); }

        let porcentajeDescuento = 0;
        let colorBurbuja = "#2ecc71";

        const UMBRAL_MINIMO = 7;
        const DESCUENTO_MAXIMO = 30;
        const FACTOR_MULTIPLICADOR = 0.6;

        if (score >= UMBRAL_MINIMO) {
            porcentajeDescuento = Math.round(score * FACTOR_MULTIPLICADOR);

            if (porcentajeDescuento > DESCUENTO_MAXIMO) {
                porcentajeDescuento = DESCUENTO_MAXIMO;
            }

            if (porcentajeDescuento >= 22) {
                colorBurbuja = "#e74c3c";
            } else if (porcentajeDescuento >= 12) {
                colorBurbuja = "#f1c40f";
            } else {
                colorBurbuja = "#2ecc71";
            }
        }

        let config = porcentajeDescuento > 0 ? { label: porcentajeDescuento + "%", color: colorBurbuja } : null;

        return { score, config, desglose };
    }

    function aplicarLogicaDeNegocio(fila) {
        try {
            if (fila.querySelector('.burbuja-estrategia') || fila.dataset.procesado === "true") return;

            let datos = extraerDatosPieza(fila);
            if (!datos) return;

            let resultado = calcularScoreYDescuento(datos);
            let score = resultado.score;
            let config = resultado.config;
            let desglose = resultado.desglose;

            console.groupCollapsed(`[Pieza: ${datos.numPieza}] Score Final: ${score}`);
            console.log("Valores detectados:", { stock: datos.stock, vd: datos.vd, calidad: datos.calidad, edad: datos.edad, anioPieza: datos.anioPieza });
            console.log("Desglose de puntos:");
            desglose.forEach(item => console.log(` - ${item}`));
            console.log("Resultado:", config ? `Descuento ${config.label}` : "Sin descuento (Score < 7)");
            console.groupEnd();

            if (config) {
                let span = document.createElement('span');
                span.className = 'burbuja-estrategia';
                span.style.cssText = `background:${config.color}; color:white; padding: 2px 6px; border-radius:10px; margin-left:5px; font-weight:bold; font-size:10px;`;
                span.innerText = config.label;
                datos.celdas[1].appendChild(span);
            }

            fila.dataset.procesado = "true";

        } catch (e) { console.error("Error en pieza:", e); }
    }

    function procesarFilas() {
        document.querySelectorAll('tr.stock-row').forEach(aplicarLogicaDeNegocio);
    }

    procesarFilas();

    const observer = new MutationObserver(() => {
        procesarFilas();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();