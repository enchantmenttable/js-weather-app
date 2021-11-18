let dailyDataHolder = [];
let moveLeftDistances = [];
let timeZoneDiff;

const bannerTemp = document.getElementById("banner-temp");
const bannerDesc = document.getElementById("banner-desc");
const displayTime = document.getElementById("display-time");
const bannerHumidity = document.querySelector("#banner-humidity > span");
const bannerWindSpeed = document.querySelector("#banner-wind-speed > span");
const bannerWeatherIcon = document.getElementById("banner-weather-icon");

function setMoveLeftDistances(stepLength, stepsFromFirstTick) {
    return [
        0,
        -(stepsFromFirstTick * stepLength),
        -(stepLength * 8 + stepsFromFirstTick * stepLength),
        -(stepLength * 8 * 2 + stepsFromFirstTick * stepLength),
        -(stepLength * 8 * 3 + stepsFromFirstTick * stepLength),
    ]
};

const chartWrapper = document.getElementById("chart-wrapper"),
    chartWrapperStyleSet = window.getComputedStyle(chartWrapper),
    chartWrapperWidth = parseInt(chartWrapperStyleSet.getPropertyValue("width").slice(0, -2)) - 36;

function mode(arr) {
    return arr.sort((a, b) =>
        arr.filter(v => v === a).length
        - arr.filter(v => v === b).length
    ).pop();
}

function avg(arr) {
    return arr.reduce((a, b) => a + b) / arr.length;
}

function isNumeric(str) {
    return !isNaN(str) && !isNaN(parseFloat(str))
}

function cleanAddress(address) {
    let words = address.split(",");
    let result = [];
    for (const word of words) {
        if (!isNumeric(word)) {
            result.push(word);
        }
    };
    return result.join(", ")
}


function updateChart(chart, labels, data) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.options.scales.y.suggestedMin = Math.min(...data) - 2;
    chart.options.scales.y.suggestedMax = Math.max(...data) + 3;
    chart.update();
}

function updateWeatherDisplay(address, cityLat, cityLon) {
    chartWrapper.style.transition = "0.8s";
    chartWrapper.style.marginLeft = `0px`;

    dailyDataHolder = [];
    const weatherApiKey = "" ; // Your API Key here
    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${cityLat}&lon=${cityLon}&appid=${weatherApiKey}&units=metric`;


    fetch(weatherUrl)
        .then(res => res.json())
        .then(data => {
            timeZoneDiff = data["city"]["timezone"] / 3600;
            let timeList = [];

            // push data to dailyDataHolder
            let sliceIndices = [0];
            for (const hourData of data["list"]) {
                const d = new Date((hourData["dt"] + timeZoneDiff) * 1000);
                timeList.push(d.getDate());
            }

            for (let i = 1; i < data["list"].length; i++) {
                if (timeList[i] !== timeList[i - 1]) {
                    sliceIndices.push(i);
                }
            }

            for (let i = 1; i < sliceIndices.length; i++) {
                let chunk = data["list"].slice(sliceIndices[i - 1], sliceIndices[i]);
                let hours = [];
                let temps = [];
                let windSpeeds = [];
                let humidity = [];
                let descriptions = [];
                let iconCodes = [];
                for (const item of chunk) {
                    hours.push(Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true }).format(item["dt"] * 1000));
                    temps.push(Math.round(item["main"]["temp"]));
                    descriptions.push(item["weather"][0]["description"]);
                    iconCodes.push(item["weather"][0]["icon"]);
                    windSpeeds.push(Math.round(item["wind"]["speed"] * 3600 / 1000));
                    humidity.push(item["main"]["humidity"]);
                };
                dailyDataHolder.push({
                    dayOfWeek: Intl.DateTimeFormat("en-US", { weekday: "long" }).format(chunk[0]["dt"] * 1000),
                    hours: hours,
                    temps: temps,
                    tempMax: Math.max(...temps),
                    tempMin: Math.min(...temps),
                    windSpeeds: windSpeeds,
                    dayWindSpeed: avg(windSpeeds),
                    humidity: humidity,
                    dayHumidity: avg(humidity),
                    descriptions: descriptions,
                    dayDescription: mode(descriptions.slice()),
                    iconCodes: iconCodes,
                    dayIconCode: mode(iconCodes.slice()),
                })
            }

            // current > heading
            const currentDisplayCity = document.getElementById("display-city");
            if (address) {
                let cleanedAddress = cleanAddress(address);
                currentDisplayCity.textContent = cleanedAddress;
            } else {
                let displayAddress = `${data["city"]["name"]}, ${data["city"]["country"]}`;
                currentDisplayCity.textContent = displayAddress;
            }

            const currentData = data["list"][0];
            const currentDisplayTime = document.getElementById("display-time");
            currentDisplayTime.textContent = Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "numeric", hour12: true }).format(currentData["dt"] * 1000);

            bannerHumidity.textContent = Math.round(dailyDataHolder[0]["dayHumidity"]) + "%";
            bannerWindSpeed.textContent = Math.round(dailyDataHolder[0]["dayWindSpeed"]) + "km/h";

            // current > temp-banner
            const currentDisplayTemp = document.getElementById("banner-temp");
            currentDisplayTemp.textContent = Math.round(currentData["main"]["temp"]) + "°C";

            const currentWeatherIcon = document.getElementById("banner-weather-icon");
            currentWeatherIcon.setAttribute("src", `https://openweathermap.org/img/wn/${currentData["weather"][0]["icon"]}@4x.png`);

            const currentDisplayDescription = document.getElementById("banner-desc");
            currentDisplayDescription.textContent = `${currentData["weather"][0]["description"][0].toUpperCase()}${currentData["weather"][0]["description"].slice(1)}`;

            // hourly chart
            let hours = [];
            let temps = [];
            for (i = 0; i < data["list"].length; i++) {
                hours.push(Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true }).format(data["list"][i]["dt"] * 1000));
                temps.push(Math.round(data["list"][i]["main"]["temp"]));
            }
            updateChart(lineChart, hours, temps);

            // weekly forecast
            const cards = document.getElementsByClassName("card");
            for (let i = 0; i < 5; i++) {
                cards[i].querySelector("p").textContent = dailyDataHolder[i]["dayOfWeek"];
                cards[i].querySelector("img").setAttribute("src", `https://openweathermap.org/img/wn/${dailyDataHolder[i]["dayIconCode"]}@4x.png`);

                cards[i].querySelector("span.temp-max").textContent = dailyDataHolder[i]["tempMax"] + "°";
                cards[i].querySelector("span.temp-min").textContent = dailyDataHolder[i]["tempMin"] + "°";
            }

            // set values for chart-moving's parameters
            const stepLength = chartWrapperWidth / (data["list"].length - 1);
            const firstHour = dailyDataHolder[0]["hours"][0];
            const firstHourVal = parseInt(firstHour.slice(0, firstHour.length - 2));
            const firstHourTom = dailyDataHolder[1]["hours"][0];
            const firstHourTomVal = parseInt(firstHourTom.slice(0, firstHourTom.length - 2));
            let stepsFromFirstTick;

            if (firstHourVal !== 12) {
                if (firstHour.at(-2) === "A") {
                    stepsFromFirstTick = (firstHourTomVal + 12 - firstHourVal) / 3 + 4;
                } else {
                    stepsFromFirstTick = (firstHourTomVal + 12 - firstHourVal) / 3
                }
            } else {
                if (firstHour.at(-2) === "A") {
                    stepsFromFirstTick = 0;
                } else {
                    stepsFromFirstTick = 4;
                }
            }

            moveLeftDistances = setMoveLeftDistances(stepLength, stepsFromFirstTick);
        });
}

// init chart
const canvas = document.getElementById("line-chart");
const lineChart = new Chart(canvas, {
    plugins: [ChartDataLabels],
    type: "line",
    data: {
        datasets: [{
            fill: {
                target: "start",
                above: "#FFF5CC",
                below: "#FFF5CC",
            },
            borderColor: "#FFCC00",
        }]
    },
    options: {
        elements: {
            point: {
                radius: 0,
            },
            line: {
                tension: 0.08,
            },
        },
        plugins: {
            legend: {
                display: false
            },
            datalabels: {
                align: "top",
                anchor: "end",
                offset: 5
            }
        },
        maintainAspectRatio: false,
        scales: {
            y: {
                ticks: {
                    display: false,
                },
                grid: {
                    display: false,
                    drawBorder: false,
                }
            },
            x: {
                grid: {
                    display: false,
                    drawBorder: false,
                },
                ticks: {
                    align: "start",
                }
            }
        },
    }
});

const form = document.getElementById("search-bar");
form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("search-input");
    if (input.value) {
        const coordUrl = `https://nominatim.openstreetmap.org/search?q=${input.value}&accept-language=en&format=json`;
        fetch(coordUrl)
            .then(res => res.json())
            .then(data => {
                const address = data[0]["display_name"];
                const cityLat = data[0]["lat"];
                const cityLon = data[0]["lon"];
                updateWeatherDisplay(address, cityLat, cityLon);
            })
    }
});

let previouslyClickedOnCardIndex = 0;
const cards = document.querySelectorAll(".card");
cards.forEach((elem) => {
    elem.addEventListener("click", () => {
        let childIndex = Array.from(elem.parentNode.children).indexOf(elem);
        if (childIndex - previouslyClickedOnCardIndex !== 0) {
            chartWrapper.style.transition = "0.8s";
            chartWrapper.style.marginLeft = `${moveLeftDistances[childIndex]}px`;
            bannerTemp.textContent = `${dailyDataHolder[childIndex]["tempMax"]}°C`;
            bannerDesc.textContent = `${dailyDataHolder[childIndex]["dayDescription"][0].toUpperCase()}${dailyDataHolder[childIndex]["dayDescription"].slice(1)}`;
            bannerHumidity.textContent = Math.round(dailyDataHolder[childIndex]["dayHumidity"]) + "%";
            bannerWindSpeed.textContent = Math.round(dailyDataHolder[childIndex]["dayWindSpeed"]) + "km/h";
            displayTime.textContent = dailyDataHolder[childIndex]["dayOfWeek"];
            previouslyClickedOnCardIndex = childIndex;
            bannerWeatherIcon.setAttribute("src", `https://openweathermap.org/img/wn/${dailyDataHolder[childIndex]["dayIconCode"]}@4x.png`);
        }
    })
});

// get user's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const [lat, lon] = [position.coords.latitude, position.coords.longitude];
            updateWeatherDisplay(0, lat, lon);
        },
        (error) => {
            if (error.code === error.PERMISSION_DENIED) {
                const snackBar = document.getElementById("snack-bar");
                snackBar.innerHTML = `Location services disabled. Display Ho Chi Minh City weather by default. <span id="snack-bar-cross">⮿</span>`;
                snackBar.classList.add("fade-in");
                updateWeatherDisplay("Ho Chi Minh City, VN", 10.799126, 106.699453);
                const snackBarCross = document.getElementById("snack-bar-cross");
                snackBarCross.addEventListener("click", () => {
                    snackBar.classList.add("fade-out");
                })
            }
        }
    )
}
