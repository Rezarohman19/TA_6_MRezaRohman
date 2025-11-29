(function(){
  const API_PROXY = 'api_weather.php';
  const favoritesFile = 'favorites.json'; 
 
  const searchInput = document.getElementById('searchInput');
  const suggestionsEl = document.getElementById('suggestions');
  const saveFavBtn = document.getElementById('saveFavBtn');
  const favListEl = document.getElementById('favList');
  const statusText = document.getElementById('statusText');
  const loadingEl = document.getElementById('loading');
  const refreshBtn = document.getElementById('refreshBtn');
  const unitToggle = document.getElementById('unitToggle');
  const themeToggle = document.getElementById('themeToggle');

  const locationEl = document.getElementById('location');
  const timestampEl = document.getElementById('timestamp');
  const weatherIcon = document.getElementById('weatherIcon');
  const conditionEl = document.getElementById('condition');
  const tempEl = document.getElementById('temp');
  const tempUnitEl = document.getElementById('tempUnit');
  const feelsEl = document.getElementById('feels');
  const humidityEl = document.getElementById('humidity');
  const windEl = document.getElementById('wind');
  const forecastRow = document.getElementById('forecastRow');

  let map, mapMarker;
  let unit = localStorage.getItem('unit') || 'metric'; // metric or imperial
  unitToggle.textContent = unit === 'metric' ? '°C' : '°F';
  let currentCity = null;
  let autoTimer = null;

  function xhrGet(url, cb){
    const r = new XMLHttpRequest();
    r.open('GET', url, true);
    r.onreadystatechange = function(){
      if(r.readyState === 4){
        if(r.status >=200 && r.status <300){
          try { cb(null, JSON.parse(r.responseText)); }
          catch(e){ cb(new Error('JSON parse error')); }
        } else cb(new Error('XHR GET failed: ' + r.status));
      }
    };
    r.send();
  }

  function xhrPost(url, data, cb){
    const r = new XMLHttpRequest();
    r.open('POST', url, true);
    r.setRequestHeader('Content-Type','application/json;charset=utf-8');
    r.onreadystatechange = function(){
      if(r.readyState === 4){
        if(r.status >=200 && r.status <300){
          try { cb(null, JSON.parse(r.responseText)); }
          catch(e){ cb(new Error('JSON parse error')); }
        } else cb(new Error('XHR POST failed: ' + r.status));
      }
    };
    r.send(JSON.stringify(data));
  }

  function showLoading(show){
    loadingEl.classList.toggle('hidden', !show);
  }
  function setStatus(msg){
    statusText.textContent = msg;
  }

  function initMap(){
    map = L.map('map').setView([-6.2, 106.8], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  }
  function updateMap(lat, lon){
    map.setView([lat, lon], 11);
    if(mapMarker) map.removeLayer(mapMarker);
    mapMarker = L.marker([lat, lon]).addTo(map);
  }

  function renderCurrent(data){
    locationEl.textContent = `${data.name}, ${data.sys.country}`;
    const localTs = new Date((Date.now()) ); // use client time for display, or use timezone from API if needed
    timestampEl.textContent = localTs.toLocaleString();
    const iconCode = data.weather && data.weather[0] ? data.weather[0].icon : '';
    weatherIcon.src = iconCode ? `https://openweathermap.org/img/wn/${iconCode}@2x.png` : '';
    conditionEl.textContent = data.weather && data.weather[0] ? data.weather[0].description : '-';

    tempEl.textContent = Math.round(data.main.temp);
    tempUnitEl.textContent = unit === 'metric' ? '°C' : '°F';
    feelsEl.textContent = Math.round(data.main.feels_like) + (unit==='metric'?'°C':'°F');
    humidityEl.textContent = data.main.humidity + '%';

    let windVal = data.wind.speed;
    if(unit === 'metric'){
      
      windEl.textContent = (windVal * 3.6).toFixed(1) + ' km/h';
    } else {
      
      windEl.textContent = (windVal * 2.237).toFixed(1) + ' mph';
    }
  }

  function renderForecast(forecastData){
   
    forecastRow.innerHTML = '';
    if(!forecastData || !forecastData.list) return;
    const list = forecastData.list.filter(i => i.dt_txt.includes('12:00:00')).slice(0,5);
    list.forEach(item => {
      const d = new Date(item.dt * 1000);
      const card = document.createElement('div');
      card.className = 'forecast-card';
      card.innerHTML = `
        <div style="font-weight:700">${d.toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short'})}</div>
        <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" alt="" style="width:64px;height:64px"/>
        <div style="margin-top:6px;font-weight:700">${Math.round(item.main.temp)}${unit==='metric'?'°C':'°F'}</div>
        <div class="muted" style="text-transform:capitalize">${item.weather[0].description}</div>
      `;
      forecastRow.appendChild(card);
    });
  }

  function fetchWeatherByCoords(lat, lon, displayName){
    showLoading(true);
    setStatus('Memuat cuaca...');

    xhrGet(`${API_PROXY}?action=current_by_coords&lat=${lat}&lon=${lon}&unit=${unit}`, (err, cur)=>{
      if(err){ showLoading(false); setStatus('Kesalahan'); alert('Gagal ambil current'); return; }
      renderCurrent(cur);
      updateMap(lat, lon);
      
      xhrGet(`${API_PROXY}?action=forecast_by_coords&lat=${lat}&lon=${lon}&unit=${unit}`, (err2, fdata) => {
        showLoading(false);
        if(err2){ setStatus('Kesalahan saat ambil forecast'); return; }
        renderForecast(fdata);
        setStatus('Selesai');
      });
    });
    if(displayName) currentCity = displayName;
  }

  function fetchWeatherByName(name){
    if(!name) return;
    showLoading(true);
    setStatus('Mencari lokasi...');
    xhrGet(`${API_PROXY}?action=geocode&q=${encodeURIComponent(name)}&limit=1`, (err, data) => {
      if(err || !data || !data[0]){ showLoading(false); setStatus('Kota tidak ditemukan'); alert('Kota tidak ditemukan'); return; }
      const loc = data[0];
      const displayName = `${loc.name}${loc.state?(', '+loc.state):''}, ${loc.country}`;
      fetchWeatherByCoords(loc.lat, loc.lon, displayName);
    });
  }

  let acTimer = null;
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    suggestionsEl.innerHTML = '';
    if(acTimer) clearTimeout(acTimer);
    if(!q) return;
    acTimer = setTimeout(()=>{
      xhrGet(`${API_PROXY}?action=geocode&q=${encodeURIComponent(q)}&limit=6`, (err, data) => {
        suggestionsEl.innerHTML = '';
        if(err || !data) return;
        const list = document.createElement('div');
        list.className = 'list';
        data.forEach(item => {
          const it = document.createElement('div');
          it.className = 'item';
          it.textContent = `${item.name}${item.state? ', '+item.state: ''}, ${item.country}`;
          it.addEventListener('click', () => {
            suggestionsEl.innerHTML = '';
            searchInput.value = '';
            const displayName = `${item.name}${item.state?(', '+item.state):''}, ${item.country}`;
            currentCity = displayName;
            fetchWeatherByCoords(item.lat, item.lon, displayName);
          });
          list.appendChild(it);
        });
        suggestionsEl.appendChild(list);
      });
    }, 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      const q = searchInput.value.trim();
      if(q) fetchWeatherByName(q);
    }
  });

  function loadFavorites(){
    xhrGet(`${API_PROXY}?action=favorite_list`, (err, data) => {
      if(err) return;
      renderFavorites(data.favorites || []);
    });
  }
  function addFavorite(city){
    xhrPost(`${API_PROXY}?action=favorite_add`, {city}, (err,res) => {
      if(err) { alert('Gagal simpan favorit'); return; }
      loadFavorites();
    });
  }
  function removeFavorite(city){
    xhrPost(`${API_PROXY}?action=favorite_remove`, {city}, (err,res) => {
      if(err) { alert('Gagal hapus favorit'); return; }
      loadFavorites();
    });
  }
  function renderFavorites(list){
    favListEl.innerHTML = '';
    (list||[]).forEach(city => {
      const el = document.createElement('div');
      el.className = 'fav-item';
      el.innerHTML = `<span class="city">${city}</span><span class="del">✖</span>`;
      el.querySelector('.city').addEventListener('click', ()=> fetchWeatherByName(city));
      el.querySelector('.del').addEventListener('click', (ev)=>{ ev.stopPropagation(); removeFavorite(city); });
      favListEl.appendChild(el);
    });
  }

  saveFavBtn.addEventListener('click', ()=> {
    if(!currentCity) return alert('Belum ada kota untuk disimpan');
    addFavorite(currentCity);
  });

  refreshBtn.addEventListener('click', ()=>{
    if(currentCity) fetchWeatherByName(currentCity);
    else alert('Pilih kota dahulu');
  });

  unitToggle.addEventListener('click', ()=>{
    unit = unit === 'metric' ? 'imperial' : 'metric';
    unitToggle.textContent = unit === 'metric' ? '°C' : '°F';
    localStorage.setItem('unit', unit);
    if(currentCity) fetchWeatherByName(currentCity);
  });

  themeToggle.addEventListener('click', ()=>{
    document.body.classList.toggle('light');

    themeToggle.textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  });

  function startAutoUpdate(){
    if(autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(()=>{
      if(currentCity) fetchWeatherByName(currentCity);
    }, 5 * 60 * 1000);
  }

  function init(){
    initMap();
    loadFavorites();
   
    const last = localStorage.getItem('lastCity');
    if(last) fetchWeatherByName(last);
    else fetchWeatherByName('Jakarta'); 
    startAutoUpdate();
  }

  const origFetchWeatherByCoords = fetchWeatherByCoords;
  fetchWeatherByCoords = function(lat, lon, displayName){
    origFetchWeatherByCoords(lat, lon, displayName);
    if(displayName) localStorage.setItem('lastCity', displayName);
  };

  init();

})();
