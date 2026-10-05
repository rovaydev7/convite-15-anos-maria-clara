(() => {
  'use strict';

  const pageUrl = new URL(window.location.href);
  const scriptUrl = `${pageUrl.origin}${pageUrl.pathname}`;
  const csrfToken = document.body.dataset.csrf || '';
  const isAdmin = document.body.dataset.admin === 'true';
  const photoGrid = document.getElementById('photo-grid');
  const photoCount = document.getElementById('photo-count');
  const emptyState = document.getElementById('gallery-empty');
  const faceStatus = document.getElementById('face-status');
  const clearSearchButton = document.getElementById('clear-search');
  const photoDialog = document.getElementById('photo-dialog');
  const photoDialogImage = document.getElementById('photo-dialog-image');
  const faceApiScriptUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
  const faceOptions = { inputSize: 320, scoreThreshold: 0.45 };
  const faceMatchThreshold = 0.72;
  const faceFallbackLimit = 4;
  const descriptorCache = new Map();
  let photos = [];
  let cameraStream = null;
  let faceModelsPromise = null;

  function setFaceStatus(message) {
    faceStatus.textContent = message;
  }

  function setUploadStatus(message, isError = false) {
    const status = document.getElementById('upload-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  async function readJsonResponse(response) {
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || result.ok !== true) {
      throw new Error(result?.message || 'Não foi possível concluir a solicitação.');
    }
    return result;
  }

  function createPhotoCard(photo) {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.dataset.photoName = photo.name;

    const openButton = document.createElement('button');
    openButton.className = 'photo-open';
    openButton.type = 'button';
    openButton.setAttribute('aria-label', 'Ampliar foto da festa');
    const image = document.createElement('img');
    image.src = photo.thumbnailUrl;
    image.alt = 'Foto dos 15 anos de Maria Clara';
    image.loading = 'lazy';
    image.decoding = 'async';
    openButton.append(image);
    openButton.addEventListener('click', () => {
      photoDialogImage.src = photo.imageUrl;
      photoDialog.showModal();
    });
    card.append(openButton);

    if (isAdmin) {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'photo-delete';
      deleteButton.type = 'button';
      deleteButton.textContent = '×';
      deleteButton.setAttribute('aria-label', 'Remover foto da galeria');
      deleteButton.addEventListener('click', () => deletePhoto(photo, card, deleteButton));
      card.append(deleteButton);
    }
    return card;
  }

  function renderPhotos(list, { emptyMessage = 'A galeria está pronta para as fotos' } = {}) {
    photoGrid.replaceChildren(...list.map(createPhotoCard));
    photoCount.textContent = String(list.length);
    emptyState.hidden = list.length !== 0;
    const emptyHeading = emptyState.querySelector('h3');
    const emptyCopy = emptyState.querySelector('p');
    emptyHeading.textContent = emptyMessage;
    emptyCopy.textContent = list.length === 0 && emptyMessage !== 'A galeria está pronta para as fotos'
      ? 'Tente outra selfie ou mostre todas as fotos novamente.'
      : 'As imagens compartilhadas pela família aparecerão aqui em miniatura.';
  }

  async function loadPhotos() {
    const response = await fetch(`${scriptUrl}?action=list`, { credentials: 'same-origin', cache: 'no-store' });
    const result = await readJsonResponse(response);
    photos = result.photos;
    renderPhotos(photos);
  }

  async function deletePhoto(photo, card, button) {
    if (!window.confirm('Remover esta foto da galeria?')) return;
    button.disabled = true;
    const formData = new FormData();
    formData.append('_csrf', csrfToken);
    formData.append('name', photo.name);
    try {
      const response = await fetch(`${scriptUrl}?action=delete`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      await readJsonResponse(response);
      photos = photos.filter((entry) => entry.name !== photo.name);
      descriptorCache.delete(photo.name);
      card.remove();
      photoCount.textContent = String(photos.length);
      emptyState.hidden = photos.length !== 0;
    } catch (error) {
      window.alert(error.message);
      button.disabled = false;
    }
  }

  async function uploadPhotos(files) {
    if (!files.length) return;
    const uploadButton = document.getElementById('upload-open');
    uploadButton.disabled = true;
    let uploadedCount = 0;
    const errors = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      setUploadStatus(`Enviando ${index + 1} de ${files.length}: ${file.name}`);
      const formData = new FormData();
      formData.append('_csrf', csrfToken);
      formData.append('photos[]', file, file.name);
      try {
        const response = await fetch(`${scriptUrl}?action=upload`, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
        });
        await readJsonResponse(response);
        uploadedCount++;
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    uploadButton.disabled = false;
    document.getElementById('photo-upload').value = '';
    if (uploadedCount > 0) await loadPhotos();
    const summary = `${uploadedCount} de ${files.length} foto(s) enviada(s).`;
    setUploadStatus(errors.length ? `${summary} ${errors.join(' ')}` : summary, errors.length > 0);
  }

  async function loadFaceModels() {
    if (faceModelsPromise) return faceModelsPromise;
    faceModelsPromise = (async () => {
      if (!window.faceapi) {
        throw new Error('Não foi possível carregar a busca facial. Verifique sua conexão e tente novamente.');
      }
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(faceApiScriptUrl),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(faceApiScriptUrl),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(faceApiScriptUrl),
      ]);
    })();
    return faceModelsPromise;
  }

  function loadImageElement(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível abrir uma imagem.'));
      image.src = source;
    });
  }

  async function getFaceDescriptors(image) {
    const detections = await window.faceapi
      .detectAllFaces(image, new window.faceapi.TinyFaceDetectorOptions(faceOptions))
      .withFaceLandmarks()
      .withFaceDescriptors();
    return detections.map((detection) => ({
      descriptor: detection.descriptor,
      area: detection.detection.box.width * detection.detection.box.height,
    }));
  }

  async function selfieDescriptor(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImageElement(objectUrl);
      const faces = await getFaceDescriptors(image);
      if (faces.length === 0) {
        throw new Error('Não encontramos um rosto nessa selfie. Escolha uma foto nítida, de frente e com boa iluminação.');
      }
      return faces.sort((left, right) => right.area - left.area)[0].descriptor;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function photoDescriptors(photo) {
    if (descriptorCache.has(photo.name)) return descriptorCache.get(photo.name);
    const promise = (async () => {
      const image = await loadImageElement(photo.thumbnailUrl);
      return getFaceDescriptors(image);
    })();
    descriptorCache.set(photo.name, promise);
    try {
      return await promise;
    } catch (error) {
      descriptorCache.delete(photo.name);
      throw error;
    }
  }

  function getClosestFaceDistance(queryDescriptor, faceDescriptors) {
    return faceDescriptors.reduce((closest, face) => {
      const distance = window.faceapi.euclideanDistance(queryDescriptor, face.descriptor);
      if (!Number.isFinite(distance)) return closest;
      return Math.min(closest, distance);
    }, Number.POSITIVE_INFINITY);
  }

  async function findMatchingPhotos(file) {
    if (photos.length === 0) {
      setFaceStatus('Ainda não há fotos na galeria para comparar.');
      return;
    }

    const selfieInput = document.getElementById('selfie-file');
    selfieInput.disabled = true;
    document.getElementById('camera-start').disabled = true;
    clearSearchButton.hidden = true;
    try {
      setFaceStatus('Carregando o reconhecimento facial no seu dispositivo...');
      await loadFaceModels();
      setFaceStatus('Analisando a selfie somente neste navegador...');
      const queryDescriptor = await selfieDescriptor(file);
      const scoredMatches = [];
      for (let index = 0; index < photos.length; index++) {
        setFaceStatus(`Comparando com as fotos da festa: ${index + 1} de ${photos.length}...`);
        try {
          const faces = await photoDescriptors(photos[index]);
          const closestDistance = getClosestFaceDistance(queryDescriptor, faces);
          if (Number.isFinite(closestDistance)) {
            scoredMatches.push({ photo: photos[index], distance: closestDistance });
          }
        } catch (error) {
          console.warn('Não foi possível analisar uma foto da galeria.', error);
        }
      }

      const matches = scoredMatches
        .filter((entry) => entry.distance <= faceMatchThreshold)
        .sort((left, right) => left.distance - right.distance)
        .map((entry) => entry.photo);

      if (matches.length === 0 && scoredMatches.length > 0) {
        scoredMatches
          .sort((left, right) => left.distance - right.distance)
          .slice(0, faceFallbackLimit)
          .forEach((entry) => matches.push(entry.photo));
      }

      renderPhotos(matches, { emptyMessage: 'Não encontramos fotos com esse rosto' });
      clearSearchButton.hidden = false;
      setFaceStatus(matches.length === 1
        ? 'Encontramos 1 foto com esse rosto.'
        : `Encontramos ${matches.length} fotos com esse rosto.`);
    } catch (error) {
      setFaceStatus(error.message || 'Não foi possível fazer a busca facial.');
    } finally {
      selfieInput.disabled = false;
      document.getElementById('camera-start').disabled = false;
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    document.getElementById('camera-video').srcObject = null;
    document.getElementById('camera-panel').hidden = true;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFaceStatus('Este navegador não permite acesso à câmera. Escolha uma selfie do aparelho.');
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      const video = document.getElementById('camera-video');
      video.srcObject = cameraStream;
      document.getElementById('camera-panel').hidden = false;
      await video.play();
      setFaceStatus('Enquadre seu rosto e toque em “Usar esta selfie”. A imagem não será enviada.');
    } catch (error) {
      stopCamera();
      setFaceStatus('Não foi possível abrir a câmera. Confira a permissão do navegador ou escolha uma selfie.');
    }
  }

  function captureSelfie() {
    const video = document.getElementById('camera-video');
    if (!video.videoWidth || !video.videoHeight) {
      setFaceStatus('A câmera ainda está iniciando. Tente novamente em alguns segundos.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setFaceStatus('Não foi possível preparar a selfie. Tente novamente.');
        return;
      }
      stopCamera();
      findMatchingPhotos(new File([blob], 'selfie-local.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', .9);
  }

  document.getElementById('selfie-file').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) findMatchingPhotos(file);
  });
  document.getElementById('camera-start').addEventListener('click', startCamera);
  document.getElementById('capture-selfie').addEventListener('click', captureSelfie);
  document.getElementById('camera-cancel').addEventListener('click', stopCamera);
  clearSearchButton.addEventListener('click', () => {
    renderPhotos(photos);
    clearSearchButton.hidden = true;
    setFaceStatus('Exibindo todas as fotos novamente.');
  });

  document.getElementById('admin-open')?.addEventListener('click', () => {
    document.getElementById('admin-dialog').showModal();
  });
  document.getElementById('admin-close')?.addEventListener('click', () => {
    document.getElementById('admin-dialog').close();
  });
  document.getElementById('upload-open')?.addEventListener('click', () => {
    document.getElementById('photo-upload').click();
  });
  document.getElementById('photo-upload')?.addEventListener('change', (event) => {
    uploadPhotos(Array.from(event.target.files || []));
  });
  document.getElementById('photo-close').addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('close', () => {
    photoDialogImage.removeAttribute('src');
  });
  window.addEventListener('pagehide', stopCamera);

  loadPhotos().catch((error) => {
    setFaceStatus(error.message || 'Não foi possível carregar a galeria. Atualize a página para tentar novamente.');
  });
})();