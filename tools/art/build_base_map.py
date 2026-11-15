"""Build the lander interior map (Tiled JSON, .tmj) after base_reference.png.

    python3 -I tools/art/build_base_map.py <atlas.json> <tiles.json> <out.tmj>

The sheet pieces already sit where base_reference.png shows them (the sheet is that picture taken
apart), so each prop is placed at its own sheet position; rooms, walls and doors follow the same
64-px grid. Open the result in Tiled to adjust; the game reads the same file.
"""
import json
import sys

TILE = 64
COLS, ROWS = 30, 18

# '#' hull wall, 'F' wall face (panels drawn by props), 'B' back wall of a room (the wall art with
# posters, cabinets, the wall map: floor-coloured in the picture, but you cannot walk there),
# 'D' doorway, '.' floor, ' ' outside.
MAP = [
    '                              ',
    '           ########           ',
    ' ###########......########### ',
    ' #BBBBBBBBB#......#BBBBBBBBB# ',
    ' #.........#......#BBBBBBBBB# ',
    ' #.........###DD###.........# ',
    ' #.........FFFDDFFF.........# ',
    ' #.........FFFDDFFF.........# ',
    ' #..........................# ',
    ' #.........###DD###.........# ',
    ' #.........#BBDDBB#.........# ',
    ' #.........#BB....#.........# ',
    ' ####DD#####......########### ',
    ' #BBBDDBBBB#......########### ',
    ' #.........#......#           ',
    ' #.........#......#           ',
    ' #.........#......#           ',
    ' ##################           ',
]
# Rooms (cols, rows of floor) for the floor look and for roomAt().
ROOMS = {
    'bridge': (12, 2, 18, 5),
    'lab': (2, 3, 11, 12),
    'hall': (11, 5, 19, 9),
    'greenhouse': (19, 3, 28, 12),
    'quarters': (2, 13, 11, 17),
    'engine': (12, 10, 18, 17),
}
FLOOR = {'engine': 'floor_plain_b', 'bridge': 'floor_plain_b'}

# Props: atlas name -> (layer, action or None). Position = the piece's place in the reference.
PROPS = {
    # bridge
    'bridge_deck': ('props', 'work'),
    # lab
    'world_map': ('wall', None), 'lab_tools_hanging': ('wall', None),
    'lab_pegboard': ('wall', None), 'lab_server_rack': ('props', None),
    'lab_computers': ('props', 'work'), 'lab_printer_tower': ('props', None),
    'ai_monitor': ('props', 'talk'), 'lab_cabinet_small': ('props', None),
    'crate_rocks': ('props', None), 'crate_soil': ('props', None), 'crate_empty': ('props', None),
    'crate_rocks_b': ('props', None), 'crate_soil_b': ('props', None),
    'lab_pc_side': ('props', 'work'), 'lab_chair': ('props', None),
    'lab_table_rocks': ('props', 'work'), 'lab_table_jars': ('props', 'work'),
    'bio_tank_a': ('props', None), 'floor_vent': ('floor', None), 'bio_tank_b': ('props', None),
    'pipes_floor': ('floor', None), 'lab_locker_tall': ('props', None),
    'lab_bench_corner': ('props', 'work'), 'lab_box_green': ('props', None),
    'lab_bench_scope': ('props', 'work'), 'lab_bench_soil': ('props', 'work'),
    # hall
    'hall_wall_l': ('props', 'exit'), 'hall_wall_r': ('props', None),
    # greenhouse
    'gh_header': ('wall', None), 'planter_left': ('props', 'tend'),
    'tank_blue_top': ('props', None), 'tank_green_top': ('props', None),
    'planter_right': ('props', 'tend'), 'tank_blue_tall': ('props', None),
    'tank_blue_tall_b': ('props', None), 'tank_pipe': ('floor', None),
    'bed_plants_a': ('props', 'tend'), 'bed_plants_b': ('props', 'tend'), 'channel': ('floor', None),
    'planter_berries': ('props', 'tend'), 'sprinkler_a': ('props', None),
    'tank_green_tall': ('props', None), 'tank_blue_tall_c': ('props', None),
    'aquarium': ('props', 'work'), 'pump_a': ('props', None), 'pump_b': ('props', None),
    'planter_bush': ('props', 'tend'), 'planter_low': ('props', 'tend'),
    'sprinkler_b': ('props', None), 'sprinkler_c': ('props', None),
    # quarters
    'kitchen_hood': ('wall', None), 'kitchen_cabinet': ('wall', None),
    'kitchen_stove': ('props', None), 'kitchen_sink': ('props', None),
    'kitchen_fridge': ('props', None), 'plant_big': ('props', None),
    'dining_chair_l': ('props', None), 'dining_table': ('props', None),
    'dining_chair_r': ('props', None), 'poster_octopus': ('wall', None),
    'poster_tree': ('wall', None), 'wall_shelf': ('wall', None),
    'wall_screen': ('wall', None), 'side_plant': ('props', None),
    'lounge_sofa': ('props', 'sleep'), 'lounge_arcade': ('props', 'work'),
    'armchair_l': ('props', 'sleep'), 'coffee_table': ('props', None),
    'armchair_r': ('props', 'sleep'), 'lounge_sofa_b': ('props', 'sleep'),
    # engine room
    'engine_wall_pipes': ('wall', None), 'engine_wall_panel': ('props', 'work'),
    'box_cardboard': ('props', None), 'box_wrench': ('props', None), 'box_tools': ('props', None),
    'box_parts': ('props', None), 'engine_core': ('props', None), 'generator': ('props', 'work'),
}
# Pieces you walk over or that hang on a wall: no collision.
WALKOVER = {'engine_core'}
# The reactor and its pipework are one clean sprite (so the cables stay whole); these invisible
# bases give it collision and actions: name -> (x0, y0, x1, y1, action).
COLLIDERS = {
    'reactor': (912, 900, 1004, 958, 'work'),
    'reactor_pipework': (1004, 868, 1146, 1062, None),
}
# Depth override (base y) for sprites without a base of their own.
DEPTH = {'engine_core': 958}
# Doors: the wall_door sprite at the reference position (px) of each doorway.
DOORS = {'bridge': (897, 385), 'engine': (897, 597), 'quarters': (333, 790)}
SPAWN = (960, 548)


def tile_layer(name, data, lid):
    return {'id': lid, 'name': name, 'type': 'tilelayer', 'width': COLS, 'height': ROWS,
            'x': 0, 'y': 0, 'opacity': 1, 'visible': True, 'data': data}


def prop(name, layer, lid, frame, action, oid):
    x, y = frame['at']
    o = {'id': oid, 'name': name, 'type': 'prop', 'x': x, 'y': y, 'width': frame['w'],
         'height': frame['h'], 'rotation': 0, 'visible': True,
         'properties': [{'name': 'sprite', 'type': 'string', 'value': name}]}
    fp = None if name in WALKOVER else frame.get('footprint') or [0, 0.6, 1, 1]
    if layer in ('overlay', 'wall', 'floor'):
        fp = None
    if layer in ('wall', 'floor'):
        # Hangs on the back wall or lies flat on the floor: always drawn behind the astronaut.
        o['properties'].append({'name': 'mount', 'type': 'string', 'value': layer})
    if name in DEPTH:
        o['properties'].append({'name': 'depth', 'type': 'float', 'value': DEPTH[name]})
    if fp:
        o['properties'].append({'name': 'footprint', 'type': 'string', 'value': ','.join(map(str, fp))})
    if action:
        o['properties'].append({'name': 'action', 'type': 'string', 'value': action})
    return o


def main(atlas_path, tiles_path, out):
    atlas = json.load(open(atlas_path))['frames']
    tiles = json.load(open(tiles_path))
    gid = {n: i + 1 for i, n in enumerate(tiles['names'])}
    room_at = lambda c, r: next((k for k, (c0, r0, c1, r1) in ROOMS.items()
                                 if c0 <= c < c1 and r0 <= r < r1), 'hall')
    floor, walls = [], []
    for r, line in enumerate(MAP):
        for c, ch in enumerate(line):
            walkable = ch in '.D'
            floor.append(gid[FLOOR.get(room_at(c, r), 'floor_plain')] if walkable or ch in 'FB' else 0)
            if ch == 'B':
                walls.append(gid['wall_back'])
            elif ch in '#F':
                at = lambda dc, dr: MAP[r + dr][c + dc] if 0 <= r + dr < ROWS and 0 <= c + dc < COLS else ' '
                sides = ''.join(k for k, (dc, dr) in zip('NESW', ((0, -1), (1, 0), (0, 1), (-1, 0)))
                                if at(dc, dr) in '.D')
                walls.append(gid[f'wall_{sides or "dark"}'])
            else:
                walls.append(0)
    oid = 1
    props, overlay = [], []
    for name, (layer, action) in PROPS.items():
        o = prop(name, layer, 0, atlas[name], action, oid)
        oid += 1
        (overlay if layer in ('overlay', 'wall', 'floor') else props).append(o)
    for name, (x0, y0, x1, y1, action) in COLLIDERS.items():
        o = {'id': oid, 'name': name, 'type': 'collider', 'x': x0, 'y': y0, 'width': x1 - x0,
             'height': y1 - y0, 'rotation': 0, 'visible': True,
             'properties': [{'name': 'footprint', 'type': 'string', 'value': '0,0,1,1'}]}
        if action:
            o['properties'].append({'name': 'action', 'type': 'string', 'value': action})
        props.append(o)
        oid += 1
    props.sort(key=lambda o: o['y'] + o['height'])
    door_frame = atlas['wall_door']
    doors = []
    for name, (x, y) in DOORS.items():
        doors.append({'id': oid, 'name': name, 'type': 'door', 'x': x, 'y': y,
                      'width': door_frame['w'], 'height': door_frame['h'], 'rotation': 0, 'visible': True,
                      'properties': [{'name': 'sprite', 'type': 'string', 'value': 'wall_door'}]})
        oid += 1
    markers = [{'id': oid, 'name': 'spawn', 'type': 'spawn', 'point': True, 'x': SPAWN[0], 'y': SPAWN[1],
                'width': 0, 'height': 0, 'rotation': 0, 'visible': True}]
    oid += 1
    rooms = [{'id': oid + i, 'name': k, 'type': 'room', 'x': c0 * TILE, 'y': r0 * TILE,
              'width': (c1 - c0) * TILE, 'height': (r1 - r0) * TILE, 'rotation': 0, 'visible': True}
             for i, (k, (c0, r0, c1, r1)) in enumerate(ROOMS.items())]
    oid += len(rooms)
    tmj = {
        'type': 'map', 'version': '1.10', 'tiledversion': '1.10.2', 'orientation': 'orthogonal',
        'renderorder': 'right-down', 'infinite': False, 'width': COLS, 'height': ROWS,
        'tilewidth': TILE, 'tileheight': TILE, 'nextlayerid': 8, 'nextobjectid': oid,
        'tilesets': [{
            'firstgid': 1, 'name': 'interior_tiles', 'image': '../../../../public/assets/interior/tiles.webp',
            'imagewidth': tiles['columns'] * TILE,
            'imageheight': ((len(tiles['names']) + tiles['columns'] - 1) // tiles['columns']) * TILE,
            'tilewidth': TILE, 'tileheight': TILE, 'columns': tiles['columns'],
            'tilecount': len(tiles['names']), 'margin': 0, 'spacing': 0,
            'tiles': [{'id': i, 'properties': [{'name': 'collides', 'type': 'bool', 'value': n.startswith('wall')},
                                               {'name': 'name', 'type': 'string', 'value': n}]}
                      for i, n in enumerate(tiles['names'])],
        }],
        'layers': [
            tile_layer('Floor', floor, 1),
            tile_layer('Walls', walls, 2),
            {'id': 3, 'name': 'Furniture/Props', 'type': 'objectgroup', 'draworder': 'topdown',
             'objects': props, 'opacity': 1, 'visible': True, 'x': 0, 'y': 0},
            {'id': 4, 'name': 'Doors', 'type': 'objectgroup', 'draworder': 'topdown',
             'objects': doors, 'opacity': 1, 'visible': True, 'x': 0, 'y': 0},
            {'id': 5, 'name': 'Decor/Overlay', 'type': 'objectgroup', 'draworder': 'topdown',
             'objects': overlay, 'opacity': 1, 'visible': True, 'x': 0, 'y': 0},
            {'id': 6, 'name': 'Markers', 'type': 'objectgroup', 'draworder': 'topdown',
             'objects': markers + rooms, 'opacity': 1, 'visible': True, 'x': 0, 'y': 0},
        ],
    }
    json.dump(tmj, open(out, 'w'), separators=(',', ':'))
    print('map', COLS, 'x', ROWS, len(props), 'props', len(overlay), 'overlay', len(doors), 'doors')


if __name__ == '__main__':
    main(*sys.argv[1:4])
