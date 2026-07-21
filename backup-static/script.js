document.addEventListener('DOMContentLoaded', () => {
    // 1. Logique du menu mobile
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const icon = mobileMenuBtn.querySelector('i');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
            
            if (mobileMenu.classList.contains('hidden')) {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            } else {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            }
        });
    }

    // 2. Fluctuation du nombre d'utilisateurs
    const userCountEl = document.getElementById('user-count');
    if (userCountEl) {
        let currentCount = parseInt(userCountEl.innerText);

        setInterval(() => {
            const change = Math.floor(Math.random() * 10) - 3; 
            currentCount += change;
            
            if (currentCount < 200) {
                currentCount = 200 + Math.floor(Math.random() * 50);
            }
            
            userCountEl.style.opacity = '0';
            setTimeout(() => {
                userCountEl.innerText = currentCount;
                userCountEl.style.opacity = '1';
            }, 200);
        }, 5000);
    }

    // 3. Logique du Carrousel en Boucle Infinie (360)
    const sliderTrack = document.getElementById('slider-track');
    const sliderPrev = document.getElementById('slider-prev');
    const sliderNext = document.getElementById('slider-next');

    if (sliderTrack && sliderPrev && sliderNext) {
        const originalSlides = Array.from(sliderTrack.children);
        const totalOriginals = originalSlides.length;
        const cardWidth = 340; // largeur d'une carte + gap

        // Cloner pour créer l'effet infini 360
        // On clone les 2 premiers et on les ajoute à la fin, on clone les 2 derniers et on les ajoute au début
        const clonesToPrepend = originalSlides.slice(-2).map(slide => slide.cloneNode(true));
        const clonesToAppend = originalSlides.slice(0, 2).map(slide => slide.cloneNode(true));

        clonesToPrepend.forEach(clone => {
            clone.classList.add('is-clone');
            sliderTrack.insertBefore(clone, sliderTrack.firstChild);
        });

        clonesToAppend.forEach(clone => {
            clone.classList.add('is-clone');
            sliderTrack.appendChild(clone);
        });

        const allSlides = Array.from(sliderTrack.children);
        
        // L'index de départ réel (le premier élément non-clone, cad après les 2 prepended)
        let currentIndex = 2; 

        function updateSlidesHighlight() {
            allSlides.forEach((slide, i) => {
                const isCurrent = i === currentIndex;
                if (isCurrent) {
                    slide.style.opacity = '1';
                    slide.style.transform = 'scale(1.03)';
                } else {
                    slide.style.opacity = '0.75';
                    slide.style.transform = 'scale(1)';
                }
            });
        }

        function scrollToCurrent(animate = true) {
            sliderTrack.style.scrollBehavior = animate ? 'smooth' : 'auto';
            // Calculer la position pour centrer la carte active dans le slider
            const targetScroll = currentIndex * cardWidth - (sliderTrack.clientWidth - cardWidth) / 2;
            sliderTrack.scrollLeft = targetScroll;
            updateSlidesHighlight();
        }

        // Saut instantané pour l'effet de boucle
        let isTransitioning = false;
        sliderTrack.addEventListener('scroll', () => {
            if (isTransitioning) return;

            // Détection de dépassement pour boucle invisible
            if (currentIndex >= totalOriginals + 2) {
                isTransitioning = true;
                setTimeout(() => {
                    sliderTrack.style.scrollBehavior = 'auto';
                    currentIndex = 2;
                    scrollToCurrent(false);
                    isTransitioning = false;
                }, 350); // Le temps de transition de l'animation smooth
            } else if (currentIndex < 2) {
                isTransitioning = true;
                setTimeout(() => {
                    sliderTrack.style.scrollBehavior = 'auto';
                    currentIndex = totalOriginals + 1;
                    scrollToCurrent(false);
                    isTransitioning = false;
                }, 350);
            }
        });

        function nextSlide() {
            if (isTransitioning) return;
            currentIndex++;
            scrollToCurrent(true);
        }

        function prevSlide() {
            if (isTransitioning) return;
            currentIndex--;
            scrollToCurrent(true);
        }

        sliderNext.addEventListener('click', nextSlide);
        sliderPrev.addEventListener('click', prevSlide);

        // Au clic sur n'importe quel modèle (incluant les clones)
        sliderTrack.addEventListener('click', (e) => {
            const card = e.target.closest('.slide-item');
            if (card) {
                const url = card.getAttribute('data-preview');
                if (url) window.open(url, '_blank');
            }
        });

        // Drag-to-Scroll sur Ordinateur
        let isDown = false;
        let startX;
        let scrollLeft;

        sliderTrack.addEventListener('mousedown', (e) => {
            isDown = true;
            sliderTrack.style.scrollBehavior = 'auto';
            sliderTrack.style.cursor = 'grabbing';
            startX = e.pageX - sliderTrack.offsetLeft;
            scrollLeft = sliderTrack.scrollLeft;
        });

        sliderTrack.addEventListener('mouseleave', () => {
            isDown = false;
            sliderTrack.style.cursor = 'grab';
        });

        sliderTrack.addEventListener('mouseup', () => {
            isDown = false;
            sliderTrack.style.cursor = 'grab';
            
            // Réaligner sur la carte la plus proche après le drag
            const rawIndex = Math.round((sliderTrack.scrollLeft + (sliderTrack.clientWidth - cardWidth) / 2) / cardWidth);
            currentIndex = Math.max(2, Math.min(rawIndex, totalOriginals + 1));
            scrollToCurrent(true);
        });

        sliderTrack.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - sliderTrack.offsetLeft;
            const walk = (x - startX) * 1.5;
            sliderTrack.scrollLeft = scrollLeft - walk;
        });

        // Initialisation après un court délai pour laisser le temps de chargement
        setTimeout(() => {
            scrollToCurrent(false);
        }, 150);
    }
});
