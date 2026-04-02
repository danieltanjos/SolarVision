package br.com.solarvision.api.controller;

import br.com.solarvision.api.dto.GroupDtos;
import br.com.solarvision.api.dto.PanelDtos;
import br.com.solarvision.api.service.GroupService;
import br.com.solarvision.api.service.PanelService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/groups")
public class GroupController {

    private final GroupService groupService;
    private final PanelService panelService;

    public GroupController(GroupService groupService, PanelService panelService) {
        this.groupService = groupService;
        this.panelService = panelService;
    }

    @GetMapping
    public List<GroupDtos.GroupResponse> list() {
        return groupService.listAll();
    }

    @PostMapping
    public GroupDtos.GroupResponse create(@Valid @RequestBody GroupDtos.GroupRequest request) {
        return groupService.create(request);
    }

    @GetMapping("/{groupId}")
    public GroupDtos.GroupResponse getById(@PathVariable Long groupId) {
        return groupService.getById(groupId);
    }

    @PatchMapping("/{groupId}")
    public GroupDtos.GroupResponse update(@PathVariable Long groupId, @Valid @RequestBody GroupDtos.GroupRequest request) {
        return groupService.update(groupId, request);
    }

    @DeleteMapping("/{groupId}")
    public GroupDtos.DeleteResponse delete(@PathVariable Long groupId) {
        return groupService.delete(groupId);
    }

    @GetMapping("/{groupId}/panels")
    public List<PanelDtos.PanelResponse> listPanels(@PathVariable Long groupId) {
        return panelService.listByGroup(groupId);
    }
}
