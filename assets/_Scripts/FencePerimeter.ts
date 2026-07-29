import {
    BoxCollider,
    find,
    instantiate,
    Node,
    Quat,
    Vec3,
} from 'cc';

const GENERATED_ROOT_NAME = 'FencePerimeterRuntime';
const RAIL_TEMPLATE_NAME = 'SM_ZhaLan';
const POST_TEMPLATE_NAME = 'SM_ZhaLanZhu';
const REPLACED_VISUAL_NAMES = new Set([
    'SM_ZhaLan002',
    'Box001',
    'Box002',
    'Box003',
]);
const REPLACED_VISUAL_MARKERS = [
    '阻挡',
    '围栏',
    '墙',
];

// Imported FBX bounds at unit scale.
const RAIL_MODEL_LENGTH = 0.053174244;
const RAIL_MODEL_HEIGHT = 0.030841799;
const POST_MODEL_HEIGHT = 0.02918618;

// The source pieces are very small. These scales produce a roughly
// 1.6-unit-high fence and a 2.7-unit rail span.
const RAIL_SCALE = 52;
const POST_SCALE = 55;
const RAIL_LENGTH = RAIL_MODEL_LENGTH * RAIL_SCALE;
const RAIL_HEIGHT = RAIL_MODEL_HEIGHT * RAIL_SCALE;
const POST_HEIGHT = POST_MODEL_HEIGHT * POST_SCALE;
const GROUND_Y = -0.55;
const FENCE_CENTER_Y = GROUND_Y + Math.max(RAIL_HEIGHT, POST_HEIGHT) * 0.5;
const POST_DEDUPLICATION = 0.08;

type FenceSegment = {
    center: Vec3;
    length: number;
    yaw: number;
    alongX: boolean;
};

/**
 * Builds the visible fence directly from the non-trigger BoxColliders on the
 * LandObj/Collision air-wall node. Collider gaps therefore remain entrances.
 */
export function buildFencePerimeterFromAirWalls(): boolean {
    const collisionNode = find('LandObj/Collision');
    const railTemplate = find(RAIL_TEMPLATE_NAME);
    const postTemplate = find(POST_TEMPLATE_NAME);
    if (!collisionNode || !railTemplate || !postTemplate) {
        console.warn('FencePerimeter: Collision or fence templates are missing.');
        return false;
    }

    hideOriginalWallsAndFence(collisionNode.scene);

    const parent = collisionNode.parent ?? collisionNode.scene;
    parent?.getChildByName(GENERATED_ROOT_NAME)?.destroy();
    if (!parent) return false;

    const generatedRoot = new Node(GENERATED_ROOT_NAME);
    generatedRoot.setParent(parent);

    const segments = collisionNode.getComponents(BoxCollider)
        .filter(collider => !collider.isTrigger)
        .map(collider => colliderToSegment(collider));

    const postPositions: Vec3[] = [];
    for (const segment of segments) {
        buildRails(segment, railTemplate, generatedRoot);
        collectPosts(segment, postPositions);
    }

    const uniquePostPositions = deduplicatePositions(postPositions);
    for (const position of uniquePostPositions) {
        const post = instantiate(postTemplate);
        post.name = 'FencePost';
        normalizeImportedMeshScale(post);
        post.setParent(generatedRoot);
        post.setWorldPosition(position);
        post.setWorldScale(POST_SCALE, POST_SCALE, POST_SCALE);
    }

    // These two scene nodes are source templates only.
    railTemplate.active = false;
    postTemplate.active = false;
    console.info(
        `FencePerimeter: replaced visible walls along ${segments.length} air-wall segments ` +
        `with ${generatedRoot.children.length - uniquePostPositions.length} rails and ` +
        `${uniquePostPositions.length} posts.`,
    );
    return true;
}

function colliderToSegment(collider: BoxCollider): FenceSegment {
    const node = collider.node;
    const worldCenter = new Vec3();
    Vec3.transformMat4(worldCenter, collider.center, node.worldMatrix);

    const worldScale = node.worldScale;
    const xLength = Math.abs(collider.size.x * worldScale.x);
    const zLength = Math.abs(collider.size.z * worldScale.z);
    const alongX = xLength >= zLength;

    return {
        center: new Vec3(worldCenter.x, FENCE_CENTER_Y, worldCenter.z),
        length: alongX ? xLength : zLength,
        yaw: node.eulerAngles.y + (alongX ? 0 : 90),
        alongX,
    };
}

function buildRails(segment: FenceSegment, template: Node, parent: Node): void {
    const count = Math.max(1, Math.ceil(segment.length / RAIL_LENGTH));
    const span = segment.length / count;
    const lengthScale = span / RAIL_MODEL_LENGTH;
    const start = -segment.length * 0.5 + span * 0.5;

    for (let index = 0; index < count; index++) {
        const offset = start + index * span;
        const rail = instantiate(template);
        rail.name = 'FenceRail';
        normalizeImportedMeshScale(rail);
        rail.setParent(parent);
        rail.setWorldPosition(
            segment.center.x + (segment.alongX ? offset : 0),
            segment.center.y,
            segment.center.z + (segment.alongX ? 0 : offset),
        );
        rail.setWorldRotation(Quat.fromEuler(new Quat(), 0, segment.yaw, 0));
        rail.setWorldScale(lengthScale, RAIL_SCALE, RAIL_SCALE);
    }
}

function collectPosts(segment: FenceSegment, output: Vec3[]): void {
    const count = Math.max(1, Math.ceil(segment.length / RAIL_LENGTH));
    const span = segment.length / count;
    const start = -segment.length * 0.5;
    for (let index = 0; index <= count; index++) {
        const offset = start + index * span;
        output.push(new Vec3(
            segment.center.x + (segment.alongX ? offset : 0),
            segment.center.y,
            segment.center.z + (segment.alongX ? 0 : offset),
        ));
    }
}

function deduplicatePositions(positions: Vec3[]): Vec3[] {
    const unique = new Map<string, Vec3>();
    for (const position of positions) {
        const key = [
            Math.round(position.x / POST_DEDUPLICATION),
            Math.round(position.z / POST_DEDUPLICATION),
        ].join(':');
        if (!unique.has(key)) unique.set(key, position);
    }
    return [...unique.values()];
}

function normalizeImportedMeshScale(root: Node): void {
    const visit = (node: Node): void => {
        if (node !== root) node.setScale(1, 1, 1);
        for (const child of node.children) visit(child);
    };
    visit(root);
}

function hideOriginalWallsAndFence(scene: Node | null): void {
    if (!scene) return;
    const visit = (node: Node): void => {
        const shouldReplace = REPLACED_VISUAL_NAMES.has(node.name)
            || REPLACED_VISUAL_MARKERS.some(marker => node.name.includes(marker));
        if (shouldReplace) node.active = false;
        for (const child of node.children) visit(child);
    };
    visit(scene);
}
