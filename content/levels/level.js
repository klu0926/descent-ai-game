export const LEVELS = [
    {
        "id": 1,
        "name": "Level 1",
        "backgroundImages": [
            "level/level_background/level_1/level_1_gate.png",
            "level/level_background/level_1/level_1_wall.png",
            "level/level_background/level_1/level_1_guard_room.png",
            "level/level_background/level_1/level_1_red_room.png",
            "level/level_background/level_1/level_1_shop.png",
            "level/level_background/level_1/level_1_gold_gate.png",
            "level/level_background/level_1/level_1_church.png",
            "level/level_background/level_1/level_1_gate_collapsed.png",
            "level/level_background/level_1/level_1_sewer.png",
            "level/level_background/level_1/level_1_market.png",
            "level/level_background/level_1/level_1_train_station.png",
            "level/level_background/level_1/level_1_prison.png",
            "level/level_background/level_1/level_1_wall_hole.png",
            "level/level_background/level_1/level_1_portal.png"
        ],
        "scenes": [
            {
                "enemy": null,
                "cutsceneVideo": "resources/cutscene/cutscene_video/gate_opening.mp4",
                "vendorItems": [],
                "background": "level/level_background/level_1/level_1_guard_room.png",
                "backgroundImageName": "level_1_guard_room",
                "type": "cutscene"
            },
            {
                "enemy": "archer",
                "cutsceneVideo": null,
                "vendorItems": [],
                "background": "level/level_background/level_1/level_1_sewer.png",
                "backgroundImageName": "level_1_sewer",
                "type": "fight"
            },
            {
                "enemy": "slime",
                "cutsceneVideo": null,
                "vendorItems": [],
                "background": "level/level_background/level_1/level_1_wall.png",
                "backgroundImageName": "level_1_wall",
                "type": "fight"
            },
            {
                "enemy": "guard",
                "cutsceneVideo": null,
                "vendorItems": [],
                "background": "level/level_background/level_1/level_1_prison.png",
                "backgroundImageName": "level_1_prison",
                "type": "fight"
            },
            {
                "enemy": "peasant_1",
                "cutsceneVideo": null,
                "vendorItems": [],
                "background": "level/level_background/level_1/level_1_market.png",
                "backgroundImageName": "level_1_market",
                "type": "fight"
            },
            {
                "enemy": "golem",
                "cutsceneVideo": null,
                "vendorItems": [],
                "background": "level/level_background/level_1/level_1_train_station.png",
                "backgroundImageName": "level_1_train_station",
                "type": "fight"
            }
        ]
    }
];

export const DEFAULT_LEVEL_ID = 1;

export function getLevelById(levelId) {
    return LEVELS.find(level => level.id === levelId) ?? null;
}
