// Unbridled Media reporting structure. Drives the Org Chart view on the Roster
// page AND the manager auto-fill on the OOO request form.
export const ORG_TREE = [
  {
    name: 'Mike Walsh',
    reports: [
      { name: 'Alex Northup', reports: [{ name: 'Fabrizio Alberdi' }, { name: 'Daniel Neville' }] },
      { name: 'Kelly Hueseman', reports: [{ name: 'Joey Goldman' }, { name: 'Anabelle Porio' }] },
      { name: 'Derik Smith', reports: [{ name: 'Tyler Castle' }, { name: 'Mason Vitro' }, { name: 'Jon Arneson' }] },
      { name: 'Nate Woodard', reports: [{ name: 'Shaun Teamer' }] },
    ],
  },
  {
    name: 'Ben Lamb',
    reports: [{ name: 'Joe Seebeck' }],
  },
];

// Flat "who reports to whom" map (lower-cased name → manager display name),
// derived from ORG_TREE so the two never drift.
export const MANAGER_OF = (() => {
  const map = {};
  const walk = (node, manager) => {
    if (manager) map[node.name.toLowerCase()] = manager;
    (node.reports || []).forEach(r => walk(r, node.name));
  };
  ORG_TREE.forEach(root => walk(root, null));
  return map;
})();

// The manager display name for a given person (or '' if top-level / unknown).
export const managerFor = name => MANAGER_OF[(name || '').trim().toLowerCase()] || '';
