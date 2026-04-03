document.addEventListener('DOMContentLoaded', () => {
    const planBtn = document.getElementById('plan-btn');
    const destinationInput = document.getElementById('destination-input');
    const loaderOverlay = document.getElementById('loader-overlay');
    const resultSection = document.getElementById('result-section');
    const timelineContent = document.getElementById('timeline-content');
    const mapTitle = document.getElementById('map-title');
    const planTitle = document.getElementById('plan-title');
    const planDesc = document.getElementById('plan-desc');
    
    let map = null;
    let markers = [];
    let routeLine = null;

    // Dinamik kurgusal açıklamalar havuzu (API'den dönen başlıkları süslemek için)
    const descPool = [
        "Bölgenin zengin kültürel dokusunu hissedin ve harika hatıra fotoğrafları çekin.",
        "Şehrin tarihi miraslarından birini yakından görerek geçmişe yolculuk yapın.",
        "Yerel atmosferi en iyi deneyimleyebileceğiniz ikonik noktalardan biri.",
        "Harika manzarası ve mimarisiyle listede mutlaka olması gereken bir durak.",
        "Sakin bir yürüyüş sonrası etrafı seyretmek için mükemmel bir nokta."
    ];
    
    const emojiPool = ["🏛️", "📸", "🎭", "🚶", "✨", "📍"];
    const times = ["09:00", "11:30", "14:00", "16:30", "19:00"];

    function initMap() {
        if (!map) {
            map = L.map('map').setView([20.0, 0.0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OSM contributors',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);
        }
    }

    function clearMap() {
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        if (routeLine) {
            map.removeLayer(routeLine);
            routeLine = null;
        }
    }

    function renderTimeline(timelineData, dataCenter) {
        timelineContent.innerHTML = '';
        const waypoints = [];
        
        timelineData.forEach((item, index) => {
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.style.animationDelay = `${index * 0.15}s`;
            
            timelineItem.innerHTML = `
                <div class="timeline-time">${item.emoji} ${item.time}</div>
                <h3 class="timeline-title">${item.title}</h3>
                <p class="timeline-desc">${item.desc}</p>
            `;
            timelineContent.appendChild(timelineItem);

            if(item.lat && item.lng) {
                waypoints.push(L.latLng(item.lat, item.lng));
                
                const circleMarker = L.circleMarker([item.lat, item.lng], {
                    radius: 12,
                    fillColor: "#fca311",
                    color: "#fff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                }).addTo(map);
                
                // Add a number inside or near the marker for sequence
                circleMarker.bindTooltip(`${index + 1}`, { permanent: true, direction: 'center', className: 'marker-tooltip' }).openTooltip();
                
                // Google Maps yönlendirmesi
                const mapsLink = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
                circleMarker.bindPopup(`<b>${item.time}</b><br>${item.title}<br><br><a href="${mapsLink}" target="_blank" style="color: #fca311; text-decoration: none; font-weight: bold;">📍 Google Haritalar'da Aç</a>`);
                markers.push(circleMarker);
            }
        });

        // Add Routing Line (Polyline)
        if (waypoints.length > 1) {
            routeLine = L.polyline(waypoints, {
                color: '#b084f8', 
                opacity: 0.8, 
                weight: 5,
                dashArray: '10, 10', // Kesik kesik modern çizgi
                lineJoin: 'round'
            }).addTo(map);
            
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        } else if(dataCenter) {
            map.setView(dataCenter, 13);
        }
    }

    async function searchDestination() {
        let dest = destinationInput.value.trim();
        if(!dest) return;

        resultSection.classList.add('hidden');
        loaderOverlay.classList.remove('hidden');

        try {
            // 1. ADIM: OpenStreetMap API ile Aranan Şehrin Koordinatlarını Bul
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dest)}`);
            const geoData = await geoRes.json();

            if (!geoData || geoData.length === 0) {
                throw new Error("Lütfen geçerli veya daha bilindik bir şehir/mekan girin (Harita eşleşmesi bulunamadı).");
            }

            const lat = parseFloat(geoData[0].lat);
            const lng = parseFloat(geoData[0].lon);
            const fullName = geoData[0].display_name.split(',')[0]; 

            // 2. ADIM: Wikipedia GeoSearch API ile o koordinata yakın en turistik 5 yeri bul
            // origin=* parametresi CORS hatasını önlemek içindir
            const wikiRes = await fetch(`https://tr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=5&format=json&origin=*`);
            const wikiData = await wikiRes.json();

            let places = [];
            if (wikiData && wikiData.query && wikiData.query.geosearch) {
                places = wikiData.query.geosearch;
            }

            // Eğer çevrede Wiki verisi yoksa fallback kullan
            if (places.length === 0) {
                places = [
                    { title: "Şehir Meydanı Gezisi", lat: lat + 0.001, lon: lng + 0.001 },
                    { title: "Yerel Lezzetler Turu", lat: lat - 0.002, lon: lng - 0.002 },
                    { title: "Tarihi Sokaklar", lat: lat + 0.003, lon: lng - 0.001 }
                ];
            }

            // 3. ADIM: Gelen ham veriyi uygulamanın "Senaryosuna (Timeline)" dönüştür
            const timelineArray = places.map((place, index) => {
                return {
                    time: times[index] || "21:00",
                    title: place.title,
                    desc: descPool[index % descPool.length], 
                    lat: place.lat,
                    lng: place.lon,
                    emoji: emojiPool[index % emojiPool.length]
                };
            });

            // UI Güncellemeleri
            loaderOverlay.classList.add('hidden');
            resultSection.style.display = 'grid'; 

            setTimeout(() => {
                resultSection.classList.remove('hidden');
                
                initMap();
                clearMap();
                
                mapTitle.innerHTML = `
                    <h3>${fullName}</h3>
                    <p>Akıllı Asistanınızın çıkardığı gezi rehberi.</p>
                `;
                
                planTitle.innerText = `${fullName} Rotanız Hazır!`;
                planDesc.innerText = "Bölgedeki önemli noktalara göre derlenmiş tam donanımlı listemiz.";

                renderTimeline(timelineArray, [lat, lng]);
            }, 50);

        } catch (error) {
            console.error(error);
            alert("Hata oluştu: " + error.message);
            loaderOverlay.classList.add('hidden');
        }
    }

    planBtn.addEventListener('click', searchDestination);
    
    destinationInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            searchDestination();
        }
    });
});
