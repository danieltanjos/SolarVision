package br.com.solarvision.api.controller;

import br.com.solarvision.api.model.GroupDtos;
import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping
    public List<GroupDtos.GroupResponse> listGroups() {
        return groupService.listGroups();
    }

    @GetMapping("/{groupId}")
    public GroupDtos.GroupResponse getGroup(@PathVariable Long groupId) {
        return groupService.getGroup(groupId);
    }

    @PostMapping
    public GroupDtos.GroupResponse createGroup(@Valid @RequestBody GroupDtos.CreateGroupRequest request) {
        return groupService.createGroup(request);
    }

    @PutMapping("/{groupId}")
    public GroupDtos.GroupResponse updateGroup(@PathVariable Long groupId,
                                               @Valid @RequestBody GroupDtos.UpdateGroupRequest request) {
        return groupService.updateGroup(groupId, request);
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long groupId) {
        groupService.deleteGroup(groupId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/panels")
    public List<PanelDtos.PanelResponse> listPanelsByGroup(@PathVariable Long groupId) {
        return groupService.listPanelsByGroup(groupId);
    }
}
