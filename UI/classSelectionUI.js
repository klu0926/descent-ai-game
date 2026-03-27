export function renderClassSelection({
    classOverlay,
    classOptions,
    confirmClassBtn,
    classes,
    currentGameStats,
    playPickSound,
    onClassSelected,
    onConfirmSelection
}) {
    classOptions.innerHTML = "";
    classOptions.classList.remove("has-selection");
    classOptions.classList.remove("is-interacting");
    currentGameStats.selectedClassId = null;
    confirmClassBtn.disabled = true;
    classOverlay.classList.remove("hidden");
    let hoveredClassCard = null;

    const updateClassInteractionState = () => {
        if (hoveredClassCard || currentGameStats.selectedClassId) {
            classOptions.classList.add("is-interacting");
        } else {
            classOptions.classList.remove("is-interacting");
        }
    };

    Object.values(classes).forEach(cls => {
        const card = document.createElement("div");
        card.className = `class-card ornate-border class-${cls.id} ${cls.locked ? "locked" : ""}`;
        const portraitPath = cls.portrait || "entity/player_class/wanderer/wanderer_images/portrait.png";
        card.innerHTML = `
            <div class="class-art-layer" style="background-image: linear-gradient(to bottom, rgba(8, 8, 8, 0.2) 0%, rgba(8, 8, 8, 0.78) 56%, rgba(8, 8, 8, 0.92) 100%), url('${portraitPath}')"></div>
            <div class="class-fade-layer"></div>
            <div class="class-static-layer" aria-hidden="true"></div>
            <div class="class-text-wrap">
                <div class="class-name">${cls.name}</div>
                <div class="class-desc">${cls.description}</div>
                ${cls.locked ? '<div class="class-lock-label">LOCKED</div>' : ""}
            </div>
        `;

        card.addEventListener("mouseenter", () => {
            hoveredClassCard = card;
            updateClassInteractionState();
        });

        card.addEventListener("mouseleave", () => {
            if (hoveredClassCard === card) hoveredClassCard = null;
            updateClassInteractionState();
        });

        if (!cls.locked) {
            card.onclick = () => {
                playPickSound();
                const isAlreadySelected = card.classList.contains("selected");
                document.querySelectorAll(".class-card").forEach(classCard => classCard.classList.remove("selected"));

                if (isAlreadySelected) {
                    currentGameStats.selectedClassId = null;
                    classOptions.classList.remove("has-selection");
                    confirmClassBtn.disabled = true;
                    updateClassInteractionState();
                    return;
                }

                card.classList.add("selected");
                classOptions.classList.add("has-selection");
                currentGameStats.selectedClassId = cls.id;
                updateClassInteractionState();
                onClassSelected(cls);
                confirmClassBtn.disabled = false;
            };
        }

        classOptions.appendChild(card);
    });

    updateClassInteractionState();

    confirmClassBtn.onclick = () => {
        if (!currentGameStats.selectedClassId) return;
        playPickSound();
        currentGameStats.hasActiveClassSelection = true;
        classOverlay.classList.add("hidden");
        onConfirmSelection();
    };
}
