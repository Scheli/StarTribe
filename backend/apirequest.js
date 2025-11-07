import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { parameter } from 'three/tsl';

const API_KEY = "4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga";
const WEATHER_KEY = "fc0d8f7948d44b989b580523250711";

const endpoints = {
  apod: `https://api.nasa.gov/planetary/apod?api_key=4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga`,
  insight: `https://api.nasa.gov/insight_weather/?api_key=${API_KEY}&feedtype=json&ver=1.0`,
  weather: `http://api.weatherapi.com/v1/current.json`,
};

// 1. APOD - Astronomy Picture of the Day
export async function getAPOD() {
  const res = await axios.get(endpoints.apod, {
    params: { api_key: API_KEY },
  });
  console.log('\n APOD:', res.data.title);
  return res.data;
}

// 2. InSight - Weather on Mars
export async function getInSightWeather() {
  const res = await axios.get(endpoints.insight, {
    params: {
      api_key: API_KEY,
      feedtype: 'json',
      ver: '1.0',
    },
  });
  
  const sol_keys = res.data.sol_keys;
  const latestSol = sol_keys[sol_keys.length - 1];
  const weather = res.data[latestSol];
  console.log(`\n Mars Weather on Sol ${latestSol}:`, weather.AT);
  return res.data;
}

// 3. Meteo a Terni
export async function getTerniMeteo() {
  try {
    const res = await axios.get("http://api.weatherapi.com/v1/current.json", {
      params: {
        key: WEATHER_KEY,
        q: "Terni",
        aqi: "no",
        lang: "it",
      },
    });

    const data = res.data;
    console.log("Meteo a Terni:");
    console.log(`Località: ${data.location.name}, ${data.location.country}`);
    console.log(`Temperatura: ${data.current.temp_c}°C`);
    console.log(`Condizioni: ${data.current.condition.text}`);
    console.log(`Vento: ${data.current.wind_kph} km/h`);
    return data;
  } catch (err) {
    console.error(
      "Errore nella richiesta del meteo a Terni:",
      err.response?.data || err.message
    );
    throw err;
  }
}

// Esegui tutte le richieste
(async () => {
  try {
    await getAPOD();
    await getInSightWeather();
  } catch (error) {
    console.error('Errore nelle richieste:', error.message);
  }
})();

(async () => {
  try {
    await getTerniMeteo();
  } catch (error) {
    console.error('Errore nella richiesta del meteo a Terni:', error.message);
  }
})();