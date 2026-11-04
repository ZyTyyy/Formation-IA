"""Validate role contracts offline. Requires Python >=3.11 and jsonschema.

This developer check neither launches Codex nor validates runtime isolation.
Run from any directory: python scripts/check_agent_contracts.py
"""

from copy import deepcopy
import json
from pathlib import Path
import tomllib

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]


def read_json(name):
    return json.loads((ROOT / "contracts" / name).read_text(encoding="utf-8"))


def main():
    mission_schema = read_json("agent-mission.schema.json")
    result_schema = read_json("agent-result.schema.json")
    for schema in (mission_schema, result_schema):
        Draft202012Validator.check_schema(schema)
    mission_validator = Draft202012Validator(mission_schema)
    result_validator = Draft202012Validator(result_schema)
    examples = read_json("agent-contract-examples.json")
    roles = set(mission_schema["properties"]["role"]["enum"])
    if roles != set(result_schema["properties"]["role"]["enum"]):
        raise ValueError("Les schemas ne definissent pas les memes roles")

    paths = list((ROOT / ".codex" / "agents").glob("*.toml"))
    if {path.stem for path in paths} != roles:
        raise ValueError("La liste des fichiers TOML differe des roles declares")
    for path in paths:
        role = tomllib.loads(path.read_text(encoding="utf-8"))
        if set(role) != {"name", "description", "developer_instructions"}:
            raise ValueError(f"Champs TOML inattendus : {path.name}")
        if role["name"] != path.stem:
            raise ValueError(f"Nom de role incoherent : {path.name}")
        if not all(isinstance(value, str) and value.strip() for value in role.values()):
            raise ValueError(f"Champ TOML vide ou invalide : {path.name}")

    for collection, validator in (
        (examples["missions"], mission_validator),
        (examples["results"], result_validator),
    ):
        for value in collection:
            validator.validate(value)
            if value["mode"] != "example":
                raise ValueError("Un exemple ne doit jamais etre marque real")

    negative_count = 0

    def reject(validator, value, label):
        nonlocal negative_count
        if validator.is_valid(value):
            raise ValueError(f"Entree invalide acceptee : {label}")
        negative_count += 1

    def invalid_mission(field, value, label):
        candidate = deepcopy(examples["missions"][0])
        candidate[field] = value
        reject(mission_validator, candidate, label)

    invalid_mission("role", "administrator", "role inconnu")
    invalid_mission("contractVersion", 2, "version inconnue")
    invalid_mission("attempt", 0, "tentative nulle")
    invalid_mission("shell", "commande libre", "champ inconnu")
    invalid_mission("missionId", "example-pm-1\n", "identifiant termine par un saut de ligne")
    invalid_mission("expectedArtifacts", ["docs/PRODUCT.md\n"], "chemin termine par un saut de ligne")
    for path in ("../outside.md", "docs/../outside.md", "/outside.md", "C:/outside.md", "docs\\file.md", "docs//file.md", "docs/./file.md"):
        invalid_mission("expectedArtifacts", [path], f"chemin interdit {path}")

    reviewer = deepcopy(examples["missions"][1])
    reviewer["mustDifferFromExecutionIds"] = []
    reject(mission_validator, reviewer, "reviewer sans independance")

    candidate = deepcopy(examples["results"][0])
    candidate["missionId"] += "\n"
    reject(result_validator, candidate, "identifiant de resultat avec saut de ligne")
    candidate = deepcopy(examples["results"][0])
    candidate["status"] = "blocked"
    candidate["blockers"] = []
    reject(result_validator, candidate, "blocage sans diagnostic")
    candidate = deepcopy(examples["results"][0])
    candidate["checks"] = [{"criterionId": "AC-1", "status": "passed", "evidenceId": None, "note": "Preuve manquante"}]
    reject(result_validator, candidate, "controle passe sans reference de preuve")
    candidate["checks"][0].update(status="not_run", evidenceId="example-evidence")
    reject(result_validator, candidate, "preuve attribuee a un controle non execute")
    candidate = deepcopy(examples["results"][3])
    candidate["status"] = "ready"
    reject(result_validator, candidate, "ready avec echec et constat P1")
    candidate = deepcopy(examples["results"][3])
    candidate["findings"] = []
    reject(result_validator, candidate, "correction sans constat")

    print(f"{len(paths)} TOML, 2 schemas et {len(examples['missions']) + len(examples['results'])} exemples valides ; {negative_count} cas invalides rejetes.")
    print("Validation de structure uniquement : fichiers reels, preuves, budgets, dependances et isolation restent a verifier par le futur serveur.")


if __name__ == "__main__":
    main()
