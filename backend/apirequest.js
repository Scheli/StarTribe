import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { parameter } from 'three/tsl';

const API_KEY = "4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga";
const KEY_METEOBLUE = "NYtxIfXLD8d6qJZE";

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

// 3. Mars Rover Photos
export async function getMarsRoverPhoto() {
  const res = await axios.get(endpoints.marsRover, {
    params: {
      sol: 1000,
      api_key: API_KEY,
    },
  });
  const photos = res.data.photos;
  if (photos.length > 0) {
    console.log(`\n Mars Rover Photo:`);
    console.log(photos[0].img_src);
    return res.data;
  } else {
    console.log('No photos found.');
  }
}

// 4. NASA Image and Video Library
export async function searchImageLibrary(query = 'moon') {
  const res = await axios.get(endpoints.imageLibrary, {
    params: { q: query },
  });
  const items = res.data.collection.items;
  if (items.length > 0) {
    console.log(`\n NASA Image Library search for "${query}":`);
    console.log(items[0].links[0].href);
    return res.data;
  } else {
    console.log('No items found.');
  }
}

// 5. GIBS – Satellite Imagery (Static URL Example)
export function getGIBSExampleURL() {
  const layer = 'MODIS_Terra_CorrectedReflectance_TrueColor';
  const date = '2024-07-01';
  const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&FORMAT=image/jpeg&WIDTH=1024&HEIGHT=512&CRS=EPSG:4326&BBOX=-90,-180,90,180&TIME=${date}`;
  console.log(`\n GIBS Example URL:\n${url}`);
  return res.data;
}

export async function getNightSky (city = "Rome ") {
  try {
    const geoRes = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: city,
        format: "json",
        limit: 1
      }
    });

    if(!geoRes.data || geoRes.data.length === 0) {
      console.log("Città non trovata");
      return null;
    }

    const {lat, lon} = geoRes.data[0];

    const res = await axios.get("https://my.meteoblue.com/packages/weather-api", {
      params: {
        lat,
        lon,
        apikey: KEY_METEOBLUE,
        format: "json",
        parameter: "astro, skycover, moonphase"
      }
    });

    const imageUrl = `https://www.meteoblue.com/en/weather/widget/image?city=${encodeURIComponent(city)}&lat=${lat}&lon=${lon}&forecast=night&theme=dark&tz=auto&apikey=${KEY_METEOBLUE}&size=${size}`;

    console.log(`URL cielo notturno a ${city}: ${imageUrl}`);
    return imageUrl;
  }
  catch (error) {
    console.error("Errore Meteoblue:", error.message);
  }
}

// Esegui tutte le richieste
(async () => {
  try {
    await getAPOD();
    await getInSightWeather();
    await getMarsRoverPhoto();
    await searchImageLibrary('nebula');
    getGIBSExampleURL();
    await getNightSky("Rome");
  } catch (error) {
    console.error('Errore nelle richieste:', error.message);
  }
})();
