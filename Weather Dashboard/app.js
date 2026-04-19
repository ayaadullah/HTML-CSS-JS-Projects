/* ═══════════════════════════════════════════════════════════
   STRATOS WEATHER DASHBOARD — app.js
   OpenWeatherMap API · Real-time Data · CSS Icon Renderer
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────
   ⚠️  REPLACE WITH YOUR FREE API KEY FROM:
   https://openweathermap.org/api  (takes ~2 mins)
──────────────────────────────────────────────────────────*/
const API_KEY = 'YOUR_API_KEY';

/* ── Config ─────────────────────────────────────────────── */
const BASE_URL  = 'https://api.openweathermap.org/data/2.5';
const GEO_URL   = 'https://api.openweathermap.org/geo/1.0';
let   isCelsius = true;
let   currentData = null;   // cached last weather response

/* ── DOM Refs ───────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const searchInput  = $('searchInput');
const searchBtn    = $('searchBtn');
const suggestions  = $('suggestions');
const unitToggle   = $('unitToggle');
const unitLabel    = $('unitLabel');
const loader       = $('loader');
const dashboard    = $('dashboard');
const errorState   = $('errorState');
const apiNotice    = $('apiNotice');

/* ══════════════════════════════════════════════════════════
   STATE HELPERS
══════════════════════════════════════════════════════════ */
function showLoader()    { hide(dashboard); hide(errorState); hide(apiNotice); show(loader); }
function showDashboard() { hide(loader);    hide(errorState); hide(apiNotice); show(dashboard); dashboard.classList.add('active'); }
function showError(title, msg) {
  hide(loader); hide(dashboard); hide(apiNotice);
  $('errorTitle').textContent = title;
  $('errorMsg').textContent   = msg;
  show(errorState);
}
function showApiNotice() {
  hide(loader); hide(dashboard); hide(errorState);
  show(apiNotice);
}

function show(el) { el.classList.add('active'); }
function hide(el) { el.classList.remove('active'); }

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();

  // Check API key
  if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
    showApiNotice();
    return;
  }

  // Try geolocation first
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
      ()  => fetchByCity('London')  // fallback
    );
  } else {
    fetchByCity('London');
  }
});

/* ══════════════════════════════════════════════════════════
   HEADER DATE
══════════════════════════════════════════════════════════ */
function updateHeaderDate() {
  const now = new Date();
  $('headerDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  });
}

/* ══════════════════════════════════════════════════════════
   FETCH WEATHER DATA
══════════════════════════════════════════════════════════ */
async function fetchByCity(city) {
  showLoader();
  try {
    const [weather, forecast] = await Promise.all([
      fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`).then(r => r.json()),
      fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`).then(r => r.json())
    ]);
    handleResponse(weather, forecast);
  } catch {
    showError('Connection Error', 'Could not reach weather servers. Check your connection.');
  }
}

async function fetchByCoords(lat, lon) {
  showLoader();
  try {
    const [weather, forecast] = await Promise.all([
      fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`).then(r => r.json()),
      fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`).then(r => r.json())
    ]);
    handleResponse(weather, forecast);
  } catch {
    showError('Connection Error', 'Could not reach weather servers.');
  }
}

function handleResponse(weather, forecast) {
  if (weather.cod === 401 || forecast.cod === 401) {
    showError('Invalid API Key', 'Please add a valid OpenWeatherMap API key in app.js.');
    return;
  }
  if (weather.cod === '404' || weather.cod === 404) {
    showError('City Not Found', 'Try a different city name or check spelling.');
    return;
  }
  currentData = { weather, forecast };
  renderDashboard(weather, forecast);
}

/* ══════════════════════════════════════════════════════════
   RENDER DASHBOARD
══════════════════════════════════════════════════════════ */
function renderDashboard(weather, forecast) {
  const unit   = isCelsius ? 'metric' : 'imperial';
  const symbol = isCelsius ? '°C' : '°F';
  const code   = weather.weather[0].id;
  const isNight= isNightTime(weather.sys.sunrise, weather.sys.sunset, weather.dt);

  /* ── Apply body theme class ── */
  applyThemeClass(code, isNight);

  /* ── Hero Card ── */
  $('cityName').textContent   = weather.name;
  $('countryName').textContent= weather.sys.country + ' · ' + weather.coord.lat.toFixed(2) + '°N, ' + weather.coord.lon.toFixed(2) + '°E';
  $('heroTemp').textContent   = Math.round(convertTemp(weather.main.temp)) + symbol;
  $('heroDesc').textContent   = weather.weather[0].description;
  $('heroHigh').textContent   = Math.round(convertTemp(weather.main.temp_max)) + symbol;
  $('heroLow').textContent    = Math.round(convertTemp(weather.main.temp_min)) + symbol;
  $('feelsVal').textContent   = Math.round(convertTemp(weather.main.feels_like)) + symbol;
  $('heroCloud').textContent  = weather.clouds.all + '% cloud cover';
  $('localTime').textContent  = getLocalTime(weather.timezone);

  /* ── Big CSS icon ── */
  $('weatherIconWrap').innerHTML = buildIcon(code, isNight, false);

  /* ── Stats ── */
  const humidity = weather.main.humidity;
  $('humidityVal').textContent = humidity + '%';
  setTimeout(() => { $('humidityBar').style.width = humidity + '%'; }, 100);

  const windSpeedRaw = weather.wind.speed;
  const windSpeed    = isCelsius ? windSpeedRaw : (windSpeedRaw * 2.237).toFixed(1);
  const windUnit     = isCelsius ? 'm/s' : 'mph';
  $('windVal').textContent = windSpeed + ' ' + windUnit;
  $('windArrow').style.transform = `rotate(${weather.wind.deg || 0}deg)`;

  const visKm = (weather.visibility / 1000).toFixed(1);
  $('visibilityVal').textContent = visKm + ' km';
  setTimeout(() => { $('visibilityBar').style.width = Math.min((weather.visibility / 10000) * 100, 100) + '%'; }, 100);

  /* ── UV (approximate from clouds) ── */
  const uvEst = Math.max(0, Math.round((1 - weather.clouds.all / 100) * 11 * (isNight ? 0 : 1)));
  $('uvVal').textContent = isNight ? '0' : uvEst;
  setTimeout(() => {
    const pct = Math.min((uvEst / 11) * 100, 100) + '%';
    $('uvFill').style.width = pct;
    $('uvIndicator').style.left = pct;
  }, 100);

  /* ── Sun times ── */
  $('sunriseVal').textContent = formatUnixTime(weather.sys.sunrise, weather.timezone);
  $('sunsetVal').textContent  = formatUnixTime(weather.sys.sunset,  weather.timezone);
  animateSunDot(weather.sys.sunrise, weather.sys.sunset, weather.dt, weather.timezone);

  /* ── Pressure gauge ── */
  const pressure = weather.main.pressure;
  $('pressureText').textContent = pressure;
  const pMin = 950, pMax = 1060;
  const pct  = Math.min(Math.max((pressure - pMin) / (pMax - pMin), 0), 1);
  const totalArc = 174;
  setTimeout(() => {
    $('gaugeFill').style.strokeDasharray = `${pct * totalArc} ${totalArc}`;
  }, 200);

  /* ── Hourly forecast ── */
  renderHourly(forecast, isNight);

  /* ── 5-day forecast ── */
  renderForecast(forecast);

  showDashboard();
}

/* ══════════════════════════════════════════════════════════
   HOURLY FORECAST
══════════════════════════════════════════════════════════ */
function renderHourly(forecast, baseNight) {
  const symbol = isCelsius ? '°C' : '°F';
  const items  = forecast.list.slice(0, 8);
  const now    = Date.now() / 1000;

  $('hourlyScroll').innerHTML = items.map((item, i) => {
    const isNow   = i === 0;
    const time    = i === 0 ? 'Now' : formatHour(item.dt);
    const temp    = Math.round(convertTemp(item.main.temp)) + symbol;
    const code    = item.weather[0].id;
    const night   = item.dt < (forecast.list[0].dt + 3600 * 6) ? baseNight : false;
    const pop     = item.pop ? Math.round(item.pop * 100) : 0;
    const iconHtml= buildIcon(code, night, true);

    return `
      <div class="hour-item ${isNow ? 'now' : ''}">
        <div class="hour-time">${time}</div>
        <div class="hour-icon-wrap">${iconHtml}</div>
        <div class="hour-temp">${temp}</div>
        ${pop > 0 ? `<div class="hour-pop">💧 ${pop}%</div>` : ''}
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   5-DAY FORECAST
══════════════════════════════════════════════════════════ */
function renderForecast(forecast) {
  const symbol = isCelsius ? '°C' : '°F';
  // One entry per day (12:00 UTC preferred)
  const days = {};
  forecast.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const key  = date.toDateString();
    if (!days[key]) days[key] = [];
    days[key].push(item);
  });

  const rows = Object.entries(days).slice(0, 5).map(([dateStr, items]) => {
    const date    = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const temps   = items.map(i => i.main.temp);
    const high    = Math.round(convertTemp(Math.max(...temps)));
    const low     = Math.round(convertTemp(Math.min(...temps)));
    const midday  = items[Math.floor(items.length / 2)];
    const code    = midday.weather[0].id;
    const desc    = midday.weather[0].description;
    const pop     = Math.round(Math.max(...items.map(i => i.pop || 0)) * 100);
    const iconHtml= buildIcon(code, false, true);

    return `
      <div class="forecast-row">
        <div class="forecast-day">${dayName}</div>
        <div class="forecast-icon-wrap">${iconHtml}</div>
        <div class="forecast-desc">${desc}</div>
        ${pop > 0 ? `<div class="forecast-pop">💧${pop}%</div>` : '<div class="forecast-pop"></div>'}
        <div class="forecast-temps">
          <span class="forecast-high">${high}${symbol}</span>
          <span class="forecast-low">${low}${symbol}</span>
        </div>
      </div>`;
  });

  $('forecastList').innerHTML = rows.join('');
}

/* ══════════════════════════════════════════════════════════
   CSS ICON BUILDER
══════════════════════════════════════════════════════════ */
function buildIcon(code, isNight, small) {
  const s = small ? ' sm' : '';

  // Thunderstorm
  if (code >= 200 && code < 300) {
    return `<div class="icon-storm${s}">
      <div class="storm-cloud"><div class="storm-base"></div></div>
      <div class="lightning"></div>
    </div>`;
  }
  // Drizzle / Rain
  if ((code >= 300 && code < 400) || (code >= 500 && code < 600)) {
    return `<div class="icon-rain${s}">
      <div class="rain-cloud"><div class="rain-base"></div></div>
      <div class="rain-drops">
        <div class="drop"></div><div class="drop"></div>
        <div class="drop"></div><div class="drop"></div>
        <div class="drop"></div>
      </div>
    </div>`;
  }
  // Snow / Sleet
  if (code >= 600 && code < 700) {
    return `<div class="icon-snow${s}">
      <div class="snow-cloud"><div class="snow-base"></div></div>
      <div class="snowflakes">
        <div class="flake">❄</div><div class="flake">❅</div>
        <div class="flake">❄</div><div class="flake">❅</div>
      </div>
    </div>`;
  }
  // Atmosphere (fog, haze, mist)
  if (code >= 700 && code < 800) {
    return `<div class="icon-fog${s}">
      <div class="fog-line"></div><div class="fog-line"></div>
      <div class="fog-line"></div><div class="fog-line"></div>
    </div>`;
  }
  // Clear sky
  if (code === 800) {
    if (isNight) {
      return `<div class="icon-moon${s}"><div class="moon-shape"></div></div>`;
    }
    return `<div class="icon-sun${s}">
      <div class="sun-rays">
        <div class="ray"></div><div class="ray"></div>
        <div class="ray"></div><div class="ray"></div>
        <div class="ray"></div><div class="ray"></div>
        <div class="ray"></div><div class="ray"></div>
      </div>
      <div class="sun-core"></div>
    </div>`;
  }
  // Few clouds (partly cloudy)
  if (code === 801 || code === 802) {
    return `<div class="icon-partly-cloudy${s}">
      <div class="pc-sun">
        <div class="sun-rays">
          <div class="ray"></div><div class="ray"></div>
          <div class="ray"></div><div class="ray"></div>
          <div class="ray"></div><div class="ray"></div>
          <div class="ray"></div><div class="ray"></div>
        </div>
        <div class="sun-core"></div>
      </div>
      <div class="pc-cloud">
        <div class="cloud-body"><div class="cloud-base"></div></div>
      </div>
    </div>`;
  }
  // Overcast / heavy clouds
  return `<div class="icon-cloud${s}">
    <div class="cloud-body"><div class="cloud-base"></div></div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════
   THEME CLASS
══════════════════════════════════════════════════════════ */
function applyThemeClass(code, isNight) {
  document.body.className = '';
  if (code >= 200 && code < 300)             document.body.classList.add('weather-storm');
  else if (code >= 300 && code < 700)        document.body.classList.add('weather-rain');
  else if (code >= 700 && code < 800)        document.body.classList.add('weather-fog');
  else if (code === 800 && isNight)          document.body.classList.add('weather-night');
  else if (code === 800)                     document.body.classList.add('weather-clear');
  else if (code === 801 || code === 802)     document.body.classList.add('weather-clear');
  else                                       document.body.classList.add('weather-cloudy');
}

/* ══════════════════════════════════════════════════════════
   SUN ARC ANIMATION
══════════════════════════════════════════════════════════ */
function animateSunDot(sunrise, sunset, current, timezone) {
  const total   = sunset - sunrise;
  const elapsed = Math.max(0, Math.min(current - sunrise, total));
  const progress= elapsed / total; // 0 → 1

  // Quadratic bezier point on path M10,90 Q150,5 290,90
  const t  = progress;
  const P0 = { x: 10,  y: 90 };
  const P1 = { x: 150, y: 5  };
  const P2 = { x: 290, y: 90 };
  const x  = (1-t)*(1-t)*P0.x + 2*(1-t)*t*P1.x + t*t*P2.x;
  const y  = (1-t)*(1-t)*P0.y + 2*(1-t)*t*P1.y + t*t*P2.y;

  const dot = document.getElementById('sunDot');
  if (dot) { dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); }
}

/* ══════════════════════════════════════════════════════════
   UNIT CONVERSION
══════════════════════════════════════════════════════════ */
function convertTemp(celsius) {
  return isCelsius ? celsius : (celsius * 9/5) + 32;
}

/* ══════════════════════════════════════════════════════════
   TIME HELPERS
══════════════════════════════════════════════════════════ */
function formatUnixTime(unix, timezoneOffset) {
  const d = new Date((unix + timezoneOffset) * 1000);
  return d.toISOString().slice(11, 16);
}

function formatHour(unix) {
  const d = new Date(unix * 1000);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function getLocalTime(timezoneOffset) {
  const utc = Date.now() / 1000;
  const localUnix = utc + timezoneOffset;
  const d = new Date(localUnix * 1000);
  return 'Local: ' + d.toISOString().slice(11, 16) + ' UTC';
}

function isNightTime(sunrise, sunset, current) {
  return current < sunrise || current > sunset;
}

/* ══════════════════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════════════════ */
searchBtn.addEventListener('click', () => {
  const city = searchInput.value.trim();
  if (city) { fetchByCity(city); suggestions.classList.remove('open'); }
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const city = searchInput.value.trim();
    if (city) { fetchByCity(city); suggestions.classList.remove('open'); }
  }
});

let debounceTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { suggestions.classList.remove('open'); return; }
  debounceTimer = setTimeout(() => fetchSuggestions(q), 350);
});

async function fetchSuggestions(q) {
  if (API_KEY === 'YOUR_API_KEY') return;
  try {
    const res  = await fetch(`${GEO_URL}/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`);
    const data = await res.json();
    if (!data.length) { suggestions.classList.remove('open'); return; }

    suggestions.innerHTML = data.map(city => `
      <div class="suggestion-item" data-city="${city.name}" data-lat="${city.lat}" data-lon="${city.lon}">
        <span>${city.name}</span>
        <span>${city.state ? city.state + ', ' : ''}${city.country}</span>
      </div>`).join('');

    suggestions.classList.add('open');

    suggestions.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        searchInput.value = item.dataset.city;
        suggestions.classList.remove('open');
        fetchByCoords(parseFloat(item.dataset.lat), parseFloat(item.dataset.lon));
      });
    });
  } catch { /* silent */ }
}

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) suggestions.classList.remove('open');
});

/* ══════════════════════════════════════════════════════════
   UNIT TOGGLE
══════════════════════════════════════════════════════════ */
unitToggle.addEventListener('click', () => {
  isCelsius = !isCelsius;
  unitLabel.textContent = isCelsius ? '°C' : '°F';
  if (currentData) renderDashboard(currentData.weather, currentData.forecast);
});
