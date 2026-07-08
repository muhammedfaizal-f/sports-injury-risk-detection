# Datasets — Milestone 1

This document lists the pose-estimation and injury-reference datasets identified
for this project. Full integration (loading, preprocessing, training/inference)
happens in **Milestone 2**. For M1, the goal is to identify sources, understand
their purpose, and pull a small sample to confirm accessibility.

## 1. COCO Keypoints Dataset ✅ Sample downloaded
- **Source:** https://cocodataset.org/#keypoints-2020
- **Purpose:** Pose estimation training, human motion analysis
- **What we have:** A small set of sample images saved in
  `datasets/coco_sample/` from the COCO dataset explorer, chosen for
  full-body visibility (relevant to pose estimation). Full annotation
  files (person_keypoints_*.json) are large (~240MB) and will only be
  downloaded in Milestone 2 when actually training/validating the pose
  estimation engine.
- **Why it matters:** COCO uses a standard 17-keypoint body format — the
  same keypoint format MediaPipe/OpenPose output, so it's a good reference
  for validating our own pose estimation pipeline in M2.

## 2. MPII Human Pose Dataset
- **Source:** http://human-pose.mpi-inf.mpg.de/
- **Purpose:** Body keypoint detection, activity recognition
- **Status:** Identified, format reviewed. Full dataset access requires
  registration — will request access if needed for M2 model evaluation.

## 3. SportsPose Dataset
- **Source:** Research dataset for sports-specific movement analysis
- **Purpose:** Athlete posture assessment, sport-specific movement patterns
- **Status:** Identified as the most directly relevant dataset for this project's
  domain (sports biomechanics vs. general human pose). Will prioritize for M2
  when building the biomechanical analysis engine.

## 4. Human3.6M Dataset
- **Source:** http://vision.imar.ro/human3.6m/
- **Purpose:** Human pose estimation, joint tracking, movement analysis
- **Status:** Identified. Requires registration for full access — noted as a
  candidate for deeper joint-tracking validation in later milestones.

## 5. FIFA Injury Dataset (Reference)
- **Purpose:** Injury trend analysis, risk factor modeling
- **Status:** Reference-only source. Not a pose dataset — used to inform which
  biomechanical risk factors (e.g. knee valgus, landing mechanics) correlate
  with real injury data, for the risk-scoring model in Milestone 3.

## Plan for Milestone 2
- Integrate COCO keypoint format as the reference schema for our own
  MediaPipe/OpenPose output
- Evaluate SportsPose for sport-specific validation once pose estimation
  engine is built
- Revisit Human3.6M / MPII only if additional joint-tracking accuracy
  validation is needed