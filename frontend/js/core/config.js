import * as THREE from "three";

export const SCALE = { AU: 120 };

export const TIME = { SPEED: 1.0 };

const EARTH_ROT = 0.00050;
const rotFromDayHours = (h) => EARTH_ROT * (24 / h);

export const ROT = {
  MERCURY: rotFromDayHours(1407.5),
  VENUS:   rotFromDayHours(-5832.5),
  EARTH:   EARTH_ROT,
  MARS:    rotFromDayHours(24.6229),
  JUPITER: rotFromDayHours(9.925),
  SATURN:  rotFromDayHours(10.7),
  URANUS:  rotFromDayHours(-17.24),
  NEPTUNE: rotFromDayHours(16.11),
};

const MERCURY_ORBIT = 0.00040;
const EARTH_ORBIT   = MERCURY_ORBIT * (88 / 365.25);

export const ORBIT = {
  MERCURY: MERCURY_ORBIT,
  VENUS:   EARTH_ORBIT * (365.25 / 224.701),
  EARTH:   EARTH_ORBIT,
  MARS:    EARTH_ORBIT * (365.25 / 686.98),
  JUPITER: EARTH_ORBIT / 11.862,
  SATURN:  EARTH_ORBIT / 29.4571,
  URANUS:  EARTH_ORBIT / 84.0168,
  NEPTUNE: EARTH_ORBIT / 164.8,
};

export const SUN = {
  POS: new THREE.Vector3(-80, 20, -160),
  ROT: 0.00005,
  ANGULAR_DIAM: THREE.MathUtils.degToRad(0.53),
};

export const MOON = {
  PERIOD_DAYS: 27.321661, 
  SPEED_MULT: 1000,       
};

export const ELEMENTS = {
  MERCURY: { a_AU: 0.3871, ecc: 0.2056,  incl_deg: 7.005,  raan_deg: 48.331,  argperi_deg: 29.124,  obliquity_deg: 0.03 },
  VENUS:   { a_AU: 0.7233, ecc: 0.0068,  incl_deg: 3.395,  raan_deg: 76.680,  argperi_deg: 54.884,  obliquity_deg: 177.36 },
  EARTH:   { a_AU: 1.0,    ecc: 0.0167,  incl_deg: 0.0,    raan_deg: 0.0,     argperi_deg: 102.937, obliquity_deg: 23.44 },
  MARS:    { a_AU: 1.5237, ecc: 0.0934,  incl_deg: 1.85,   raan_deg: 49.558,  argperi_deg: 286.502, obliquity_deg: 25.19 },
  JUPITER: { a_AU: 5.2044, ecc: 0.0489,  incl_deg: 1.303,  raan_deg: 100.464, argperi_deg: 273.867, obliquity_deg: 3.13 },
  SATURN:  { a_AU: 9.5826, ecc: 0.0565,  incl_deg: 2.485,  raan_deg: 113.665, argperi_deg: 339.392, obliquity_deg: 26.73 },
  URANUS:  { a_AU: 19.218, ecc: 0.0463,  incl_deg: 0.773,  raan_deg: 74.006,  argperi_deg: 96.998,  obliquity_deg: 97.77 },
  NEPTUNE: { a_AU: 30.07,  ecc: 0.008678,incl_deg: 1.769,  raan_deg: 131.784, argperi_deg: 273.187, obliquity_deg: 28.32 },
};

export const POSTFX = {
  BLOOM: { enabled: true, strength: 0.8, radius: 0.2, threshold: 0.75 },
};

export const CAMERA = {
  MIN_DIST: 3,
  MAX_DIST: 300,
  FRAME_FILL_DEFAULT: 0.6,  // 60% dell’altezza viewport
  // opzionale: override per pianeta, se proprio serve
  FRAME_FILL: {
    // JUPITER: 0.7,
    // EARTH:   0.6,
  }
};


