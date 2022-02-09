const axios = require("axios");
const fs = require("fs");

const config = JSON.parse(fs.readFileSync(`${__dirname}/config.json`, "utf-8"));

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function createBoosterJabCentersRequest({ token, rescheduling }) {
  return axios({
    method: "get",
    url: config.campinasVaccinationURLs.centrosVagasReforco,
    params: {
      demais_doses: true,
      agendamento_id_dose_anterior: config.lostDoseAppointmentId,
      sintomas_gripais: null,
      inicio_sintomas_gripais: null,
      exame_covid: null,
      resultado_exame_covid: null,
      reforco: true,
      numero_dose_reforco: 3,
      aplicacao_veiculo: false,
      reagendamento_id: (rescheduling ? config.lostDoseAppointmentId : undefined)
    },
    headers: {
      token,
    },
  });
}

function createCentersRequest({ token }) {
  return axios({
    method: "get",
    url: config.campinasVaccinationURLs.centros,
    headers: {
      token,
    },
  });
}

async function findAvailableCenters({ token, rescheduling }) {
  try {
    const [activeCenters, centers] = await Promise.all([
      createBoosterJabCentersRequest({ token, rescheduling }),
      createCentersRequest({ token }),
    ]);

    const validCenters = centers.data.filter((f) =>
      activeCenters.data.find((ac) => ac.centro_id === f.id)
    );

    const nearCenters = validCenters
      .map((center) => {
        center.distance = getDistanceFromLatLonInKm(
          center.latitude,
          center.longitude,
          config.currentPosition.latitude,
          config.currentPosition.longitude
        );
        return center;
      })
      .filter((f) => f.distance < config.maxKmDistance);

    return nearCenters;
  } catch (ex) {
    console.error(ex.message);
    return [];
  }
}

async function main({ token, rescheduling }) {
  let found = false;
  while (!found) {
    const result = await findAvailableCenters({ token, rescheduling });
    if (result.length > 0) {
      console.log(result);
      found = true;
    } else {
      console.log(`[${(new Date()).toISOString()}] Nenhum centro disponível. Aguarde...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

const args = process.argv.slice(2);
main({ token: args[0], rescheduling: args[1] === "reagendar" });
