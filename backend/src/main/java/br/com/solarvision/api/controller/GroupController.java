package br.com.solarvision.api.controller;

import br.com.solarvision.api.model.GroupDtos;
import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

    @PostMapping
    public GroupDtos.GroupResponse createGroup(@Valid @RequestBody GroupDtos.CreateGroupRequest request) {
        return groupService.createGroup(request);
    }

    @GetMapping("/{groupId}/panels")
    public List<PanelDtos.PanelResponse> listPanelsByGroup(@PathVariable Long groupId) {
        return groupService.listPanelsByGroup(groupId);
    }
}
