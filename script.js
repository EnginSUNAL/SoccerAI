// ==========================================
// MACKOLIK JS ANALİZ SİSTEMİ (V7 - Gelişmiş Matematik)
// ==========================================
let matchData; // Global data
let radarChartInstance = null;
let barChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. LocalStorage'dan Ham Admin Verilerini Çek
    let savedRawData = localStorage.getItem("soccerScienceRawData");
    if (savedRawData) {
        let rawData = JSON.parse(savedRawData);
        matchData = calculateScience(rawData);
    } else {
        matchData = calculateScience({
            host: "GS",
            teamHome: {
                id: "HOME", name: "Ev Sahibi", form: ["W", "W", "W", "W", "W"],
                stats: { xg: 2.1, golAtilan: 2, golYenilen: 1, possession: 60, shotsOnTarget: 6, shotsOffTarget: 5, rcsb: 25, cards: 1, corners: 6, fouls: 12 }
            },
            teamAway: {
                id: "AWAY", name: "Deplasman", form: ["W", "W", "W", "W", "W"],
                stats: { xg: 1.5, golAtilan: 1.2, golYenilen: 1.5, possession: 40, shotsOnTarget: 4, shotsOffTarget: 6, rcsb: 15, cards: 3, corners: 4, fouls: 15 }
            }
        });
    }

    startSimulation();
});

function calculateScience(data) {
    // Temel istatistiklerin % dağılımları:
    // Pozitif: xG(%20) + Gol(%10) + RCSB(%10) + İsabetliŞut(%10) + Korner(%5) + ToplaOynama(%5) = %60
    // Negatif: YenilenGol(-%15) + İsabetsizŞut(-%5) + Faul(-%5) + Kart(-%5) = -%30
    // Ev Sahibi Avatajı = %10
    // Net: 60% Pozitif - 30% Negatif = %30 (Temel skor / Base Puan)
    // Toplam Maksimum Teorik Puan: 30(Base) + 60(MaxPos) + 10(Home) - 0(MinNeg) = 100 Puan
    
    // Puanlama Çarpanları 100 üzerinden standardize edilmiştir:
    // xG (Max ~3.0) -> * 6.5 = 19.5 Puan (~%20)
    // Gol (Max ~3.0) -> * 3.3 = 9.9 Puan (~%10)
    // RCSB (Max ~25) -> * 0.4 = 10 Puan (~%10)
    // İsabetliŞut (Max ~10) -> * 1.0 = 10 Puan (~%10)
    // Topla Oynama (Max %100) -> * 0.05 = 5 Puan (~%5)
    // Korner (Max ~10) -> * 0.5 = 5 Puan (~%5)

    const home = data.teamHome.stats;
    const away = data.teamAway.stats;
    const hostTeam = data.host;

    let homeAdvantageBonus = (hostTeam === "GS") ? 10 : 0;
    let awayAdvantageBonus = (hostTeam === "BJK") ? 10 : 0;

    let homePower = 30 +
        (home.xg * 6.5) + (home.golAtilan * 3.3) + (home.rcsb * 0.4) +
        (home.shotsOnTarget * 1.0) + (home.corners * 0.5) + (home.possession * 0.05)
        - (home.golYenilen * 5.0) - (home.shotsOffTarget * 0.5) - (home.fouls * 0.25) - (home.cards * 1.25) + homeAdvantageBonus;

    let awayPower = 30 +
        (away.xg * 6.5) + (away.golAtilan * 3.3) + (away.rcsb * 0.4) +
        (away.shotsOnTarget * 1.0) + (away.corners * 0.5) + (away.possession * 0.05)
        - (away.golYenilen * 5.0) - (away.shotsOffTarget * 0.5) - (away.fouls * 0.25) - (away.cards * 1.25) + awayAdvantageBonus;

    if (homePower < 5) homePower = 5;
    if (awayPower < 5) awayPower = 5;
    
    // Beraberlik ihtimali, güçlerin yakınlığına göre artar (Max %30'a kadar)
    let powerDiff = Math.abs(homePower - awayPower);
    let tieProbability = Math.max(0, 30 - powerDiff); 
    
    // Kalan %'yi güçlerine göre dağıt
    let remainingProb = 100 - tieProbability;
    let totalPower = homePower + awayPower;
    
    let homeWinProb = (homePower / totalPower) * remainingProb;
    let awayWinProb = (awayPower / totalPower) * remainingProb;

    return {
        ...data,
        prediction: {
            homeWin: Math.round(homeWinProb),
            tie: Math.round(tieProbability),
            awayWin: Math.round(awayWinProb)
        }
    };
}

function startSimulation() {
    document.getElementById("analysis-screen").classList.remove("active");
    const loadingScreen = document.getElementById("loading-screen");
    loadingScreen.classList.add("active");

    document.getElementById("home-form").innerHTML = '';
    document.getElementById("away-form").innerHTML = '';
    document.getElementById("home-xg").innerHTML = '0.00';
    document.getElementById("away-xg").innerHTML = '0.00';
    document.getElementById("home-rcsb").innerHTML = '0';
    document.getElementById("away-rcsb").innerHTML = '0';
    document.getElementById("prob-home-bar").style.width = '0%';
    document.getElementById("prob-tie-bar").style.width = '0%';
    document.getElementById("prob-away-bar").style.width = '0%';
    document.getElementById("prob-home-text").innerHTML = '';
    document.getElementById("prob-tie-text").innerHTML = '';
    document.getElementById("prob-away-text").innerHTML = '';

    const progressFill = document.querySelector(".progress-fill");
    progressFill.style.width = "0%";

    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        progressFill.style.width = `${progress}%`;

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                loadingScreen.classList.remove("active");
                document.getElementById("analysis-screen").classList.add("active");
                renderAnalysisUI(matchData);
            }, 500);
        }
    }, 180);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function renderAnalysisUI(data) {
    const homeLogoImg = document.getElementById("home-logo-img");
    const homeNameTxt = document.getElementById("home-name-txt");
    const awayLogoImg = document.getElementById("away-logo-img");
    const awayNameTxt = document.getElementById("away-name-txt");

    homeLogoImg.src = data.teamHome.logo || "https://upload.wikimedia.org/wikipedia/commons/f/f6/Galatasaray_Sports_Club_Logo.png";
    awayLogoImg.src = data.teamAway.logo || "https://upload.wikimedia.org/wikipedia/commons/7/74/Besiktas_JK_Logo.png";
    
    homeNameTxt.innerText = data.teamHome.name;
    awayNameTxt.innerText = data.teamAway.name;

    // Alt bardaki kısaltmaları ayarla
    const probLabels = document.querySelector(".prob-labels").children;
    probLabels[0].innerText = data.teamHome.name;
    probLabels[1].innerText = "BERABERLİK";
    probLabels[2].innerText = data.teamAway.name;

    homeLogoImg.style.opacity = 0;
    awayLogoImg.style.opacity = 0;
    homeNameTxt.style.opacity = 0;
    awayNameTxt.style.opacity = 0;

    await delay(600);
    homeLogoImg.style.transition = awayLogoImg.style.transition = "opacity 0.8s, transform 0.8s";
    homeLogoImg.style.transform = awayLogoImg.style.transform = "scale(0.8)";
    await delay(50);
    homeLogoImg.style.opacity = 1;
    awayLogoImg.style.opacity = 1;
    homeLogoImg.style.transform = awayLogoImg.style.transform = "scale(1)";

    await delay(800);
    homeNameTxt.style.transition = awayNameTxt.style.transition = "opacity 0.6s";
    homeNameTxt.style.opacity = 1;
    awayNameTxt.style.opacity = 1;

    await delay(700);
    const homeFormGuide = document.getElementById("home-form");
    const awayFormGuide = document.getElementById("away-form");
    
    const renderForm = async (container, formArray) => {
        for (let res of formArray) {
            let span = document.createElement("span");
            span.className = `form-badge badge-${res}`;
            span.innerText = res;
            span.style.opacity = 0;
            span.style.transform = "translateY(10px)";
            container.appendChild(span);
            
            await delay(250);
            span.style.transition = "opacity 0.3s, transform 0.3s";
            span.style.opacity = 1;
            span.style.transform = "translateY(0)";
        }
    };
    
    renderForm(homeFormGuide, data.teamHome.form);
    await delay(500);
    renderForm(awayFormGuide, data.teamAway.form);

    await delay(1000);
    const statRows = document.querySelectorAll(".stat-row");
    statRows.forEach(row => row.style.opacity = 0);
    
    for (let i = 0; i < statRows.length; i++) {
        statRows[i].style.transition = "opacity 0.5s";
        statRows[i].style.opacity = 1;
        
        if(i === 0) {
            animateValue("home-xg", 0, data.teamHome.stats.xg, 800, true);
            animateValue("away-xg", 0, data.teamAway.stats.xg, 800, true);
        } else if (i === 1) {
            animateValue("home-rcsb", 0, data.teamHome.stats.rcsb, 800, false);
            animateValue("away-rcsb", 0, data.teamAway.stats.rcsb, 800, false);
        }
        await delay(800);
    }

    await delay(1200);
    initRadarChart(data);
    
    await delay(1000);
    initBarChart(data);

    await delay(1800);
    const probHomeBar = document.getElementById("prob-home-bar");
    const probTieBar = document.getElementById("prob-tie-bar");
    const probAwayBar = document.getElementById("prob-away-bar");

    probHomeBar.style.width = `${data.prediction.homeWin}%`;
    probTieBar.style.width = `${data.prediction.tie}%`;
    probAwayBar.style.width = `${data.prediction.awayWin}%`;

    animateValue("prob-home-text", 0, data.prediction.homeWin, 1500, false, "%");
    animateValue("prob-tie-text", 0, data.prediction.tie, 1500, false, "%");
    animateValue("prob-away-text", 0, data.prediction.awayWin, 1500, false, "%");
}

function animateValue(id, start, end, duration, isFloat = false, suffix = "") {
    if (start === end) return;
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        let curr = progress * (end - start) + start;
        
        if (isFloat) {
            obj.innerHTML = curr.toFixed(2) + suffix;
        } else {
            obj.innerHTML = Math.floor(curr) + suffix;
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = (isFloat ? end.toFixed(2) : end) + suffix;
        }
    };
    window.requestAnimationFrame(step);
}

function initRadarChart(data) {
    if (radarChartInstance) radarChartInstance.destroy();
    
    const radarCtx = document.getElementById('radarChart').getContext('2d');
    
    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Roboto', sans-serif";

    radarChartInstance = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: ['Faul Sayısı (-)', 'Topla Oynama (%)', 'İsabetsiz Şut (-)', 'İsabetli Şut (+)', 'Korner (+)'],
            datasets: [{
                label: data.teamHome.name,
                data: [
                    data.teamHome.stats.fouls * 5.5,
                    data.teamHome.stats.possession,
                    data.teamHome.stats.shotsOffTarget * 10,
                    data.teamHome.stats.shotsOnTarget * 8,
                    data.teamHome.stats.corners * 10
                ],
                backgroundColor: 'rgba(250, 204, 21, 0.2)',
                borderColor: '#facc15',
                pointBackgroundColor: '#facc15',
                borderWidth: 2,
                pointRadius: 3
            }, {
                label: data.teamAway.name,
                data: [
                    data.teamAway.stats.fouls * 5.5,
                    data.teamAway.stats.possession,
                    data.teamAway.stats.shotsOffTarget * 10,
                    data.teamAway.stats.shotsOnTarget * 8,
                    data.teamAway.stats.corners * 10
                ],
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: '#ffffff',
                pointBackgroundColor: '#ffffff',
                borderWidth: 2,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data') {
                        delay = context.dataIndex * 600;
                    }
                    return delay;
                }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#c9d1d9', font: { size: 10, weight: 'bold' } },
                    ticks: { display: false, max: 100, min: 0 }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    });
}

function initBarChart(data) {
    if (barChartInstance) barChartInstance.destroy();

    const barCtx = document.getElementById('barChart').getContext('2d');
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Atılan Gol', 'Yenilen Gol', 'Korner'],
            datasets: [{
                label: data.teamHome.name,
                data: [data.teamHome.stats.golAtilan, data.teamHome.stats.golYenilen, data.teamHome.stats.corners],
                backgroundColor: '#dc2626',
                borderRadius: 4
            }, {
                label: data.teamAway.name,
                data: [data.teamAway.stats.golAtilan, data.teamAway.stats.golYenilen, data.teamAway.stats.corners],
                backgroundColor: '#ffffff',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutBounce',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data') {
                        delay = context.dataIndex * 600;
                    }
                    return delay;
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ==========================================
// NATIVE BROWSER RECORDING (SEKMEYI PAYLAS)
// ==========================================
async function startNativeTabRecording() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "browser",
                frameRate: 60,
                width: { ideal: 1080 },
                height: { ideal: 1920 }
            },
            audio: false
        });

        const mimeTypes = [
            'video/mp4',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        
        let selectedMimeType = '';
        for (let type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                selectedMimeType = type;
                break;
            }
        }

        const options = { mimeType: selectedMimeType, videoBitsPerSecond: 8000000 };
        const recorder = new MediaRecorder(stream, options);
        const chunks = [];

        recorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: selectedMimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            let ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
            a.download = `Derbi_Analiz_Orijinal.${ext}`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            // Kayit bitince butonu geri getir
            document.getElementById('record-controls').style.display = 'block';
            stream.getTracks().forEach(track => track.stop());
        };

        // Butonu videoda cikmamasi icin gizle
        document.getElementById('record-controls').style.display = 'none';
        
        recorder.start(100); 
        
        // Simulasyon kurgusunu bastan baslat
        startSimulation();

        // 18 saniye (simulasyon biter bitmez) kaydi durdur!
        setTimeout(() => {
            if (recorder.state === "recording") {
                recorder.stop();
            }
        }, 18000);

    } catch (err) {
        console.error("Kayıt reddedildi veya hata:", err);
        document.getElementById('record-controls').style.display = 'block';
        alert("Video çekmek istiyorsanız Chrome üzerinden 'Sekmeyi Paylaş' onayı vermeniz gerekiyor!");
    }
}
