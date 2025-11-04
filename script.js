"use strict";

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
// ELEMENTS
const btnClear = document.querySelector(".btn--clear-all");
const sidebarControls = document.querySelector(".sidebar__controls");

class App {
  #map;
  #mapZoomLevel = 16;
  #mapEvent;
  #workouts = [];
  #markers = []; // Stores {id, marker, line} objects
  #userMarker;
  #userCoords;

  constructor() {
    // Get user's position
    this._getPosition(); // Get data from local storage

    this._getLocalStorage(); // Attach event handlers

    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    containerWorkouts.addEventListener(
      "click",
      this._handleWorkoutClick.bind(this)
    );
    if (btnClear) btnClear.addEventListener("click", this.reset.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert("Could not get your position");
        }
      );
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    this.#userCoords = [latitude, longitude];

    this.#map = L.map("map").setView(this.#userCoords, this.#mapZoomLevel);

    L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Render user location marker
    this._renderUserLocationMarker(); // Handling clicks on map

    this.#map.on("click", this._showForm.bind(this)); // Render existing markers and lines

    this.#workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
      this._renderConnectionLine(work);
    });

    if (this.#workouts.length > 0) this._showControls();
  } // METHOD: Render user's current location marker

  _renderUserLocationMarker() {
    const customIcon = L.divIcon({
      className: "user-location-icon",
      html: "🙋",
      iconSize: [25, 25],
      iconAnchor: [12, 25],
    });

    this.#userMarker = L.marker(this.#userCoords, { icon: customIcon })
      .addTo(this.#map)
      .bindPopup(
        '<h3 style="color: var(--color-brand--1); margin: 0;">Your Location</h3>',
        {
          autoClose: false,
          closeOnClick: false,
          className: "user-location-popup",
          maxWidth: 150,
        }
      )
      .openPopup();
  } // METHOD: Draw polyline connecting user location to workout location

  _renderConnectionLine(workout) {
    // Set line color based on workout type
    const color =
      workout.type === "running"
        ? "#00c46a" // Green
        : "#ffb545"; // Orange

    const latlngs = [this.#userCoords, workout.coords];

    const line = L.polyline(latlngs, {
      color: color,
      weight: 3,
      opacity: 0.8,
    }).addTo(this.#map);

    // Store the line object with its corresponding marker
    let markerObj = this.#markers.find((m) => m.id === workout.id);
    if (!markerObj) {
      markerObj = { id: workout.id };
      this.#markers.push(markerObj);
    }
    markerObj.line = line;
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";

    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    e.preventDefault(); // Get data from form

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout; // If workout running, create running object

    if (type === "running") {
      const cadence = +inputCadence.value; // Check if data is valid

      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert("Inputs must be positive numbers!");

      workout = new Running([lat, lng], distance, duration, cadence);
    } // If workout cycling, create cycling object

    if (type === "cycling") {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert("Inputs must be positive numbers!");

      workout = new Cycling([lat, lng], distance, duration, elevation);
    } // Add new object to workout array

    this.#workouts.push(workout); // Render workout on map as marker

    this._renderWorkoutMarker(workout);

    // Draw the connection line
    this._renderConnectionLine(workout); // Render workout on list

    this._renderWorkout(workout); // Hide form + clear input fields

    this._hideForm(); // Set local storage to all workouts

    this._setLocalStorage();

    // Show controls
    this._showControls();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();

    // Store marker with its ID
    let markerObj = this.#markers.find((m) => m.id === workout.id);
    if (!markerObj) {
      markerObj = { id: workout.id };
      this.#markers.push(markerObj);
    }
    markerObj.marker = marker;
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === "running")
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === "cycling")
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🗻</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML("afterend", html);
  }

  // Handle all clicks on containerWorkouts
  _handleWorkoutClick(e) {
    // 1. Check for MoveToPopup click (Original Functionality)
    const workoutEl = e.target.closest(".workout");
    if (workoutEl && !e.target.closest(".workout__controls")) {
      this._moveToPopup(e);
      return;
    }

    // 2. Check for Delete Button
    const deleteBtn = e.target.closest(".btn--delete");
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      this._deleteWorkout(id);
    }
  }

  _moveToPopup(e) {
    if (!this.#map) return;
    const workoutEl = e.target.closest(".workout");
    if (!workoutEl) return;
    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 2,
      },
    });
  }

  _deleteWorkout(id) {
    if (!confirm("Are you sure you want to delete this workout?")) return;

    // 1. Remove from #workouts array
    this.#workouts = this.#workouts.filter((work) => work.id !== id);

    // 2. Remove marker AND line from map and #markers array
    const markerObj = this.#markers.find((m) => m.id === id);
    if (markerObj) {
      if (markerObj.marker) this.#map.removeLayer(markerObj.marker);
      if (markerObj.line) this.#map.removeLayer(markerObj.line);
      this.#markers = this.#markers.filter((m) => m.id !== id);
    }

    // 3. Remove from UI list
    const workoutEl = document.querySelector(`.workout[data-id="${id}"]`);
    if (workoutEl) workoutEl.remove();

    // 4. Update local storage
    this._setLocalStorage();

    // 5. Hide controls if list is empty
    if (this.#workouts.length === 0) this._hideControls();
  }

  // Manage controls visibility
  _showControls() {
    if (sidebarControls) {
      sidebarControls.classList.remove("hidden");
    }
  }

  _hideControls() {
    if (sidebarControls) {
      sidebarControls.classList.add("hidden");
    }
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));
    if (!data) return;

    // Revive objects from JSON
    const revivedWorkouts = [];
    data.forEach((work) => {
      let workout;
      if (work.type === "running") {
        // Note: Since calculations are done in the constructor, pass raw data
        workout = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence
        );
      }
      if (work.type === "cycling") {
        workout = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevationGain
        );
      }

      // Copy data that is not calculated in constructor
      if (workout) {
        workout.id = work.id;
        workout.clicks = work.clicks;
        workout.date = new Date(work.date);
        revivedWorkouts.push(workout);
      }
    });

    this.#workouts = revivedWorkouts; // Render list items. Markers and lines are rendered in _loadMap

    this.#workouts.forEach((work) => {
      this._renderWorkout(work);
    });
  } // Reset method is now linked to a button

  reset() {
    if (
      !confirm(
        "Are you sure you want to delete ALL workouts? This action cannot be undone!"
      )
    )
      return;
    localStorage.removeItem("workouts");
    location.reload();
  }
}

const app = new App();
