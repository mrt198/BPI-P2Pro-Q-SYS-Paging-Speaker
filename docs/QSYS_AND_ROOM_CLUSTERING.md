# Q-SYS Plugin Integration & Room Clustering

## Q-SYS Plugin (`qsys/AES67_Paging_Controller.qplug`)

The Q-SYS Designer Lua plugin performs two real-time functions:

1. **Zone Directory Broadcast (Every 5s)**: Publishes all configured zones (e.g., `FOH`, `Backstage`, `Restaurant`, `Studio Theatre FOH`, `Studio Theatre Backstage`) along with their AES67 stream endpoints, mono/stereo formats, default base volume, priority order, SPL ratio, and `AllowNoneCalls` policy.
2. **Low-Latency Call Triggers (<5ms edge-triggered + 1s heartbeat)**: Emits `call_state` JSON packets over UDP multicast (`239.255.77.67:7767`) and TCP (`port 7768`) whenever `StageCallActive`, `AllCallActive`, or `GlobalAllCallActive` changes state in Q-SYS.

### Zone Announcement JSON Schema

```json
{
  "protocol": "qsys-aes67-paging-v1",
  "type": "zone_directory",
  "timestamp": 1763218000,
  "zones": [
    {
      "id": "qsys-zone-1",
      "name": "FOH",
      "calls": { "stage_active": false, "all_active": false },
      "streams": {
        "stage_calls": { "uri": "239.69.10.1:5004", "format": "Mono" },
        "all_calls": { "uri": "239.69.10.2:5004", "format": "Mono" },
        "program_1": { "uri": "239.69.20.1:5004", "format": "Stereo" },
        "program_2": { "uri": "239.69.20.2:5004", "format": "Stereo" },
        "program_3": { "uri": "239.69.20.3:5004", "format": "Mono" }
      },
      "defaults": {
        "base_volume_db": -12,
        "priority_order": "All>Stage>Prog",
        "allow_none_calls": false,
        "spl_ratio": 0.65
      }
    }
  ]
}
```

When a speaker is set to **Auto-Sync From Q-SYS** and bound to a zone, any updates pushed from the Q-SYS plugin automatically configure the speaker's 5 receive channels and default operating parameters.

---

## Room Clustering Mesh (`239.255.77.68:7768`)

Multiple BPI-P2Pro speakers installed in the same acoustic space can be joined to a named **Room** (e.g., `Main FOH Lobby`):

- **Combined Room SPL**: Every unit fitted with an I2S MEMS mic or onboard ADC broadcasts its post-AEC ambient SPL. Units aggregate the Room SPL using `Mean`, `Peak (Max)`, or `Primary Master Mic Only`. Headless units without a microphone automatically track the combined Room SPL.
- **Shared Hardware Controls**: Only one unit in a Room needs physical pushbuttons, a rotary knob, and an OLED screen. Changes made on the Room master propagate to all satellite speakers in the same Room.
