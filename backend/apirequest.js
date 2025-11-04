import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { parameter } from 'three/tsl';

const API_KEY = "4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga";

const endpoints = {
  apod: `https://api.nasa.gov/planetary/apod?api_key=4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga`,
  insight: `https://api.nasa.gov/insight_weather/?api_key=4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga`,
  marsRover: `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?api_key=4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga`,
  imageLibrary: `https://images-api.nasa.gov/search`,
  gibs: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/`,

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

// Esegui tutte le richieste
(async () => {
  try {
    await getAPOD();
    await getInSightWeather();
  } catch (error) {
    console.error('Errore nelle richieste:', error.message);
  }
})();
